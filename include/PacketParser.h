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

class PacketParser
{
public:
    PacketParser();
    ~PacketParser();

    std::optional<PacketFeature> processPacket(const uint8_t *packet, int packet_size, const struct pcap_pkthdr *header);

private:
    static constexpr int ETHERNET_HEADER_SIZE = 14;
    static constexpr int IPV4_MIN_HEADER_SIZE = 20;
    static constexpr int IPV6_HEADER_SIZE = 40;

    std::optional<IPv4PacketFeature> parseIPv4(const uint8_t *ip_header, int remaining_size, std::chrono::system_clock::time_point timestamp);
    std::optional<IPv6PacketFeature> parseIPv6(const uint8_t *ip_header, int remaining_size, std::chrono::system_clock::time_point timestamp);

    std::string getProtocolName(const uint8_t protocol_number);
    std::string ipv4ToString(uint32_t ip);
    std::string ipv6ToString(const uint8_t *ip);
    std::string bytesToHex(const uint8_t *data, size_t length);
    std::string parseIPv6ExtensionHeaders(const uint8_t *data, int remaining_size, uint8_t &next_header);
};
