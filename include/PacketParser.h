#pragma once

#include "PacketFeature.h"
#include <memory>
#include <optional>
#include <chrono>
#include <string>

#ifdef _WIN32
#include <pcap.h>
#else
#include <pcap/pcap.h>
#endif

using namespace std;

class PacketParser
{
public:
    PacketParser();
    ~PacketParser();

    optional<PacketFeature> processPacket(const uint8_t *packet, int packet_size, const struct pcap_pkthdr *header);

private:
    static const int ETHERNET_HEADER_SIZE = 14;
    static const int IPV4_MIN_HEADER_SIZE = 20;
    static const int IPV6_HEADER_SIZE = 40;

    optional<IPv4PacketFeature> parseIPv4(const uint8_t *ip_header, int remaining_size, chrono::system_clock::time_point timestamp);
    optional<IPv6PacketFeature> parseIPv6(const uint8_t *ip_header, int remaining_size, chrono::system_clock::time_point timestamp);

    string getProtocolName(uint8_t protocol_number);
    string ipv4ToString(uint32_t ip);
    string ipv6ToString(const uint8_t *ip);
    string bytesToHex(const uint8_t *data, size_t length);
    string parseIPv6ExtensionHeaders(const uint8_t *data, int remaining_size, uint8_t &next_header);
};
