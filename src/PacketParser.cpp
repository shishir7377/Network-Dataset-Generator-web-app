#include "PacketParser.h"
#include <iostream>
#include <sstream>
#include <iomanip>
#include <cstring>

#ifdef _WIN32
#include <winsock2.h>
#include <ws2tcpip.h>
#else
#include <arpa/inet.h>
#endif

using namespace std;

PacketParser::PacketParser() {}

PacketParser::~PacketParser() {}

optional<PacketFeature> PacketParser::processPacket(const uint8_t *packet, int packet_size, const struct pcap_pkthdr *header)
{
    if (packet_size < ETHERNET_HEADER_SIZE)
    {
        return nullopt;
    }

    auto timestamp = chrono::system_clock::from_time_t(header->ts.tv_sec) +
                     chrono::microseconds(header->ts.tv_usec);

    const uint8_t *ip_header = packet + ETHERNET_HEADER_SIZE;
    int remaining_size = packet_size - ETHERNET_HEADER_SIZE;

    if (remaining_size < 1)
    {
        return nullopt;
    }

    uint8_t version = (ip_header[0] >> 4) & 0x0F;

    if (version == 4)
    {
        auto ipv4_feature = parseIPv4(ip_header, remaining_size, timestamp);
        if (ipv4_feature)
        {
            PacketFeature feature(PacketFeature::Type::IPv4);
            feature.ipv4 = *ipv4_feature;
            return feature;
        }
    }
    else if (version == 6)
    {
        auto ipv6_feature = parseIPv6(ip_header, remaining_size, timestamp);
        if (ipv6_feature)
        {
            PacketFeature feature(PacketFeature::Type::IPv6);
            feature.ipv6 = *ipv6_feature;
            return feature;
        }
    }
    return nullopt;
}

optional<IPv4PacketFeature> PacketParser::parseIPv4(const uint8_t *ip_header, int remaining_size, chrono::system_clock::time_point timestamp)
{
    if (remaining_size < IPV4_MIN_HEADER_SIZE)
    {
        return nullopt;
    }

    IPv4PacketFeature feature;
    feature.timestamp = timestamp;

    feature.version = (ip_header[0] >> 4) & 0x0F;
    feature.ihl = ip_header[0] & 0x0F;
    feature.tos = ip_header[1];
    feature.total_length = ntohs(*reinterpret_cast<const uint16_t *>(&ip_header[2]));
    feature.identification = ntohs(*reinterpret_cast<const uint16_t *>(&ip_header[4]));

    uint16_t flags_and_fragment = ntohs(*reinterpret_cast<const uint16_t *>(&ip_header[6]));
    feature.flags = (flags_and_fragment >> 13) & 0x07;
    feature.fragment_offset = flags_and_fragment & 0x1FFF;

    feature.ttl = ip_header[8];
    feature.protocol = ip_header[9];
    feature.header_checksum = ntohs(*reinterpret_cast<const uint16_t *>(&ip_header[10]));

    feature.protocol_name = getProtocolName(feature.protocol);

    uint32_t src_ip = *reinterpret_cast<const uint32_t *>(&ip_header[12]);
    uint32_t dst_ip = *reinterpret_cast<const uint32_t *>(&ip_header[16]);
    feature.src_address = ipv4ToString(src_ip);
    feature.dst_address = ipv4ToString(dst_ip);

    int header_length = feature.ihl * 4;
    if (header_length > IPV4_MIN_HEADER_SIZE && header_length <= remaining_size)
    {
        int options_length = header_length - IPV4_MIN_HEADER_SIZE;
        feature.options.resize(options_length);
        memcpy(feature.options.data(), &ip_header[IPV4_MIN_HEADER_SIZE], options_length);
    }

    return feature;
}

optional<IPv6PacketFeature> PacketParser::parseIPv6(const uint8_t *ip_header, int remaining_size, chrono::system_clock::time_point timestamp)
{
    if (remaining_size < IPV6_HEADER_SIZE)
    {
        return nullopt;
    }

    IPv6PacketFeature feature;
    feature.timestamp = timestamp;

    uint32_t version_tc_fl = ntohl(*reinterpret_cast<const uint32_t *>(ip_header));
    feature.version = (version_tc_fl >> 28) & 0x0F;
    feature.traffic_class = (version_tc_fl >> 20) & 0xFF;
    feature.flow_label = version_tc_fl & 0x0FFFFF;

    feature.payload_length = ntohs(*reinterpret_cast<const uint16_t *>(&ip_header[4]));
    feature.next_header = ip_header[6];
    feature.hop_limit = ip_header[7];

    feature.src_address = ipv6ToString(&ip_header[8]);
    feature.dst_address = ipv6ToString(&ip_header[24]);

    uint8_t final_protocol = feature.next_header;

    if (remaining_size > IPV6_HEADER_SIZE)
    {
        string ext_headers = parseIPv6ExtensionHeaders(&ip_header[IPV6_HEADER_SIZE],
                                                       remaining_size - IPV6_HEADER_SIZE,
                                                       final_protocol);
        if (!ext_headers.empty())
        {
            feature.extension_headers.push_back(ext_headers);
        }
    }

    feature.protocol_name = getProtocolName(final_protocol);

    return feature;
}

string PacketParser::ipv4ToString(uint32_t ip)
{
    struct in_addr addr;
    addr.s_addr = ip;
    return string(inet_ntoa(addr));
}

string PacketParser::ipv6ToString(const uint8_t *ip)
{
    char str[INET6_ADDRSTRLEN];
    struct in6_addr addr;
    memcpy(&addr, ip, 16);

#ifdef _WIN32
    if (inet_ntop(AF_INET6, &addr, str, INET6_ADDRSTRLEN) != nullptr)
    {
        return string(str);
    }
#else
    if (inet_ntop(AF_INET6, &addr, str, INET6_ADDRSTRLEN) != nullptr)
    {
        return string(str);
    }
#endif

    ostringstream oss;
    for (int i = 0; i < 16; i += 2)
    {
        if (i > 0)
            oss << ":";
        oss << hex << setfill('0') << setw(4)
            << (static_cast<uint16_t>(ip[i]) << 8 | ip[i + 1]);
    }
    return oss.str();
}

string PacketParser::bytesToHex(const uint8_t *data, size_t length)
{
    ostringstream oss;
    for (size_t i = 0; i < length; ++i)
    {
        oss << hex << setfill('0') << setw(2) << static_cast<unsigned>(data[i]);
    }
    return oss.str();
}

string PacketParser::parseIPv6ExtensionHeaders(const uint8_t *data, int remaining_size, uint8_t &next_header)
{
    ostringstream oss;
    int offset = 0;

    while (offset < remaining_size)
    {
        switch (next_header)
        {
        case 0:  // Hop-by-Hop Options
        case 6:  // TCP
        case 17: // UDP
        case 58: // ICMPv6
            return oss.str();

        case 43: // Routing Header
        case 44: // Fragment Header
        case 60: // Destination Options
        {
            if (offset + 2 > remaining_size)
            {
                return oss.str();
            }

            if (!oss.str().empty())
                oss << ",";
            oss << "Header" << static_cast<int>(next_header);

            if (next_header == 44)
            {
                next_header = data[offset];
                offset += 8;
            }
            else
            {
                next_header = data[offset];
                uint8_t length = data[offset + 1];
                offset += 8 + length * 8;
            }
            break;
        }
        default:
            return oss.str();
        }

        if (offset >= remaining_size)
            break;
    }

    return oss.str();
}

string PacketParser::getProtocolName(uint8_t protocol_number)
{
    switch (protocol_number)
    {
    case 1:
        return "ICMP";
    case 2:
        return "IGMP";
    case 6:
        return "TCP";
    case 17:
        return "UDP";
    case 41:
        return "IPv6";
    case 47:
        return "GRE";
    case 50:
        return "ESP";
    case 51:
        return "AH";
    case 58:
        return "ICMPv6";
    case 89:
        return "OSPF";
    case 132:
        return "SCTP";
    default:
        return "PROTO_" + to_string(protocol_number);
    }
}
