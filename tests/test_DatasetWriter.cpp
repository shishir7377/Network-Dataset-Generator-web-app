#include "../src/catch_amalgamated.hpp"
#include "DatasetWriter.h"
#include <filesystem>
#include <fstream>

TEST_CASE("DatasetWriter writes CSV header and one IPv4 row", "[DatasetWriter][CSV]")
{
    namespace fs = std::filesystem;
    auto tmp = fs::temp_directory_path() / "dataset_writer_test_ipv4.csv";
    // Ensure clean start
    std::error_code ec;
    fs::remove(tmp, ec);

    DatasetWriter writer(tmp.string(), CSVMode::IPv4_ONLY);
    REQUIRE(writer.initialize());

    PacketFeature f(PacketFeature::Type::IPv4);
    auto &v4 = f.ipv4;
    v4.timestamp = std::chrono::system_clock::now();
    v4.version = 4;
    v4.ihl = 5;
    v4.tos = 0;
    v4.total_length = 20;
    v4.identification = 0x1234;
    v4.flags = 2;
    v4.fragment_offset = 0;
    v4.ttl = 64;
    v4.protocol = 6;
    v4.header_checksum = 0;
    v4.src_address = "192.168.1.1";
    v4.dst_address = "10.0.0.5";
    v4.protocol_name = "TCP";

    REQUIRE(writer.writePacket(f));
    writer.close();

    std::ifstream in(tmp);
    REQUIRE(in.is_open());

    std::string header;
    std::getline(in, header);
    std::string row;
    std::getline(in, row);

    CHECK(header == "Timestamp,Version,IHL,TOS,TotalLength,Identification,Flags,FragmentOffset,TTL,Protocol,HeaderChecksum,SrcIP,DstIP,OptionsHex,ProtocolName");
    // Light validation on row content
    CHECK(row.find("192.168.1.1") != std::string::npos);
    CHECK(row.find("10.0.0.5") != std::string::npos);
    CHECK(row.find("TCP") != std::string::npos);

    in.close();
    fs::remove(tmp, ec);
}
