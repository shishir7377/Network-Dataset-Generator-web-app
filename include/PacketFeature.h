#pragma once

#include <string>
#include <vector>
#include <cstdint>
#include <chrono>

struct IPv4PacketFeature
{
    std::chrono::system_clock::time_point timestamp;
    uint8_t version;
    uint8_t ihl;
    uint8_t tos;
    uint16_t total_length;
    uint16_t identification;
    uint8_t flags;
    uint16_t fragment_offset;
    uint8_t ttl;
    uint8_t protocol;
    uint16_t header_checksum;
    std::string src_address;
    std::string dst_address;
    std::vector<uint8_t> options;
    std::string protocol_name;

    IPv4PacketFeature() : version(0), ihl(0), tos(0), total_length(0),
                          identification(0), flags(0), fragment_offset(0),
                          ttl(0), protocol(0), header_checksum(0), protocol_name("UNKNOWN") {}
};

struct IPv6PacketFeature
{
    std::chrono::system_clock::time_point timestamp;
    uint8_t version;
    uint8_t traffic_class;
    uint32_t flow_label;
    uint16_t payload_length;
    uint8_t next_header;
    uint8_t hop_limit;
    std::string src_address;
    std::string dst_address;
    std::vector<std::string> extension_headers;
    std::string protocol_name;

    IPv6PacketFeature() : version(0), traffic_class(0), flow_label(0),
                          payload_length(0), next_header(0), hop_limit(0), protocol_name("UNKNOWN") {}
};

struct PacketFeature
{
    enum class Type
    {
        IPv4,
        IPv6
    } type;
    IPv4PacketFeature ipv4;
    IPv6PacketFeature ipv6;

    PacketFeature(Type t) : type(t) {}
};