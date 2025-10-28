#include "../src/catch_amalgamated.hpp"
#include "PacketParser.h"
#include <vector>
#include <cstdint>
#include <cstring>

#ifdef _WIN32
#include <pcap.h>
#else
#include <pcap/pcap.h>
#endif

using std::vector;

static pcap_pkthdr makeHeader(uint32_t sec, uint32_t usec, uint32_t len)
{
    pcap_pkthdr h{};
    h.ts.tv_sec = sec;
    h.ts.tv_usec = usec;
    h.caplen = len;
    h.len = len;
    return h;
}

TEST_CASE("PacketParser parses minimal IPv4/TCP frame", "[PacketParser][IPv4]")
{
    // Ethernet (14) + IPv4(20)
    vector<uint8_t> pkt;
    pkt.resize(14 + 20, 0);

    // Ethernet header: dest MAC(6) + src MAC(6) + ethertype(2)
    pkt[12] = 0x08;
    pkt[13] = 0x00; // IPv4

    // IPv4 header at offset 14
    size_t ip = 14;
    pkt[ip + 0] = 0x45; // Version=4, IHL=5
    pkt[ip + 1] = 0x00; // TOS
    pkt[ip + 2] = 0x00;
    pkt[ip + 3] = 20; // total length 20
    pkt[ip + 4] = 0x12;
    pkt[ip + 5] = 0x34; // identification
    pkt[ip + 6] = 0x40;
    pkt[ip + 7] = 0x00; // flags (DF), fragment offset 0
    pkt[ip + 8] = 64;   // TTL
    pkt[ip + 9] = 6;    // Protocol TCP
    pkt[ip + 10] = 0x00;
    pkt[ip + 11] = 0x00; // header checksum (ignored in test)
    // Src 192.168.1.1
    pkt[ip + 12] = 192;
    pkt[ip + 13] = 168;
    pkt[ip + 14] = 1;
    pkt[ip + 15] = 1;
    // Dst 10.0.0.5
    pkt[ip + 16] = 10;
    pkt[ip + 17] = 0;
    pkt[ip + 18] = 0;
    pkt[ip + 19] = 5;

    auto hdr = makeHeader(1730000000, 123456, static_cast<uint32_t>(pkt.size()));

    PacketParser parser;
    auto feature = parser.processPacket(pkt.data(), static_cast<int>(pkt.size()), &hdr);

    REQUIRE(feature.has_value());
    REQUIRE(feature->type == PacketFeature::Type::IPv4);

    const auto &v4 = feature->ipv4;
    CHECK(v4.version == 4);
    CHECK(v4.ihl == 5);
    CHECK(v4.ttl == 64);
    CHECK(v4.protocol == 6);
    CHECK(v4.protocol_name == "TCP");
    CHECK(v4.src_address == "192.168.1.1");
    CHECK(v4.dst_address == "10.0.0.5");
    CHECK(v4.options.empty());
}

TEST_CASE("PacketParser parses minimal IPv6/UDP frame", "[PacketParser][IPv6]")
{
    // Ethernet (14) + IPv6(40)
    vector<uint8_t> pkt;
    pkt.resize(14 + 40, 0);

    // Ethernet header
    pkt[12] = 0x86;
    pkt[13] = 0xDD; // IPv6

    // IPv6 header at 14
    size_t ip = 14;
    pkt[ip + 0] = 0x60; // Version=6, TrafficClass=0, FlowLabel=0 (first 4 bits 0110)
    pkt[ip + 1] = 0x00;
    pkt[ip + 2] = 0x00;
    pkt[ip + 3] = 0x00; // rest of v/tc/fl
    pkt[ip + 4] = 0x00;
    pkt[ip + 5] = 0x00; // payload length 0
    pkt[ip + 6] = 17;   // next header UDP
    pkt[ip + 7] = 64;   // hop limit

    // Src 2001:db8::1
    uint8_t src[16] = {0x20, 0x01, 0x0d, 0xb8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1};
    std::memcpy(&pkt[ip + 8], src, 16);
    // Dst 2001:db8::2
    uint8_t dst[16] = {0x20, 0x01, 0x0d, 0xb8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2};
    std::memcpy(&pkt[ip + 24], dst, 16);

    auto hdr = makeHeader(1730000000, 654321, static_cast<uint32_t>(pkt.size()));

    PacketParser parser;
    auto feature = parser.processPacket(pkt.data(), static_cast<int>(pkt.size()), &hdr);

    REQUIRE(feature.has_value());
    REQUIRE(feature->type == PacketFeature::Type::IPv6);

    const auto &v6 = feature->ipv6;
    CHECK(v6.version == 6);
    CHECK(v6.traffic_class == 0);
    CHECK(v6.flow_label == 0);
    CHECK(v6.payload_length == 0);
    CHECK(v6.next_header == 17);
    CHECK(v6.hop_limit == 64);
    CHECK(v6.protocol_name == "UDP");
    CHECK((v6.src_address == std::string("2001:db8::1") || v6.src_address.find("2001:") == 0));
    CHECK((v6.dst_address == std::string("2001:db8::2") || v6.dst_address.find("2001:") == 0));
}
