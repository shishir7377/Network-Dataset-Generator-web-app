#include "DatasetWriter.h"
#include <iostream>
#include <sstream>
#include <iomanip>
#include <filesystem>

DatasetWriter::DatasetWriter(const std::string &filename, CSVMode mode)
    : filename_(filename), is_initialized_(false), csv_mode_(mode)
{
    file_ = std::make_unique<std::ofstream>();
}

DatasetWriter::~DatasetWriter()
{
    close();
}

bool DatasetWriter::initialize()
{
    namespace fs = std::filesystem;

    bool file_exists = false;
    bool has_content = false;
    try
    {
        file_exists = fs::exists(filename_);
        if (file_exists)
        {
            std::error_code ec;
            auto size = fs::file_size(filename_, ec);
            has_content = (!ec && size > 0);
        }
    }
    catch (...)
    {
        // If filesystem checks fail for any reason, fall back to create/truncate
        file_exists = false;
        has_content = false;
    }

    std::ios_base::openmode mode = std::ios::out;
    if (has_content)
    {
        // Append to existing non-empty file
        mode |= std::ios::app;
    }
    else
    {
        // Create new file or ensure empty one gets header; use trunc to reset if it exists but is empty
        mode |= std::ios::trunc;
    }

    file_->open(filename_, mode);
    if (!file_->is_open())
    {
        last_error_ = "Failed to open file: " + filename_;
        return false;
    }

    // Only write header when file is new or empty
    if (!has_content)
    {
        writeCSVHeader();
    }

    is_initialized_ = true;
    std::cout << (has_content ? "Appending to existing CSV file: " : "Initialized new CSV output file: ") << filename_ << std::endl;
    return true;
}

bool DatasetWriter::writePacket(const PacketFeature &packet)
{
    if (!is_initialized_ || !file_->is_open())
    {
        last_error_ = "Writer not initialized or file not open";
        return false;
    }

    try
    {
        if (csv_mode_ == CSVMode::IPv4_ONLY && packet.type == PacketFeature::Type::IPv4)
        {
            const auto &ipv4 = packet.ipv4;
            *file_ << escapeCSV(formatTimestamp(ipv4.timestamp)) << ","
                   << static_cast<int>(ipv4.version) << ","
                   << static_cast<int>(ipv4.ihl) << ","
                   << static_cast<int>(ipv4.tos) << ","
                   << ipv4.total_length << ","
                   << ipv4.identification << ","
                   << static_cast<int>(ipv4.flags) << ","
                   << ipv4.fragment_offset << ","
                   << static_cast<int>(ipv4.ttl) << ","
                   << static_cast<int>(ipv4.protocol) << ","
                   << ipv4.header_checksum << ","
                   << escapeCSV(ipv4.src_address) << ","
                   << escapeCSV(ipv4.dst_address) << ","
                   << escapeCSV(vectorToHex(ipv4.options)) << ","
                   << escapeCSV(ipv4.protocol_name)
                   << std::endl;
        }
        else if (csv_mode_ == CSVMode::IPv6_ONLY && packet.type == PacketFeature::Type::IPv6)
        {
            const auto &ipv6 = packet.ipv6;
            *file_ << escapeCSV(formatTimestamp(ipv6.timestamp)) << ","
                   << static_cast<int>(ipv6.version) << ","
                   << static_cast<int>(ipv6.traffic_class) << ","
                   << ipv6.flow_label << ","
                   << ipv6.payload_length << ","
                   << static_cast<int>(ipv6.next_header) << ","
                   << static_cast<int>(ipv6.hop_limit) << ","
                   << escapeCSV(ipv6.src_address) << ","
                   << escapeCSV(ipv6.dst_address) << ","
                   << escapeCSV(vectorToString(ipv6.extension_headers)) << ","
                   << escapeCSV(ipv6.protocol_name)
                   << std::endl;
        }
        else if (csv_mode_ == CSVMode::BOTH)
        {
            // Keep existing mixed format
            if (packet.type == PacketFeature::Type::IPv4)
            {
                const auto &ipv4 = packet.ipv4;
                *file_ << escapeCSV(formatTimestamp(ipv4.timestamp)) << ","
                       << static_cast<int>(ipv4.version) << ","
                       << static_cast<int>(ipv4.ihl) << ","
                       << static_cast<int>(ipv4.tos) << ","
                       << ipv4.total_length << ","
                       << ipv4.identification << ","
                       << static_cast<int>(ipv4.flags) << ","
                       << ipv4.fragment_offset << ","
                       << static_cast<int>(ipv4.ttl) << ","
                       << static_cast<int>(ipv4.protocol) << ","
                       << ipv4.header_checksum << ","
                       << escapeCSV(ipv4.src_address) << ","
                       << escapeCSV(ipv4.dst_address) << ","
                       << escapeCSV(vectorToHex(ipv4.options)) << ","
                       << "," // TrafficClass (IPv6 only)
                       << "," // FlowLabel (IPv6 only)
                       << "," // PayloadLength (IPv6 only)
                       << "," // NextHeader (IPv6 only)
                       << "," // HopLimit (IPv6 only)
                       << "," // ExtensionHeaders (IPv6 only)
                       << escapeCSV(ipv4.protocol_name)
                       << std::endl;
            }
            else if (packet.type == PacketFeature::Type::IPv6)
            {
                const auto &ipv6 = packet.ipv6;
                *file_ << escapeCSV(formatTimestamp(ipv6.timestamp)) << ","
                       << static_cast<int>(ipv6.version) << ","
                       << "," // IHL (IPv4 only)
                       << "," // TOS (IPv4 only)
                       << "," // TotalLength (IPv4 only)
                       << "," // Identification (IPv4 only)
                       << "," // Flags (IPv4 only)
                       << "," // FragmentOffset (IPv4 only)
                       << "," // TTL (IPv4 only)
                       << "," // Protocol (IPv4 only)
                       << "," // HeaderChecksum (IPv4 only)
                       << escapeCSV(ipv6.src_address) << ","
                       << escapeCSV(ipv6.dst_address) << ","
                       << "," // Options (IPv4 only)
                       << static_cast<int>(ipv6.traffic_class) << ","
                       << ipv6.flow_label << ","
                       << ipv6.payload_length << ","
                       << static_cast<int>(ipv6.next_header) << ","
                       << static_cast<int>(ipv6.hop_limit) << ","
                       << escapeCSV(vectorToString(ipv6.extension_headers)) << ","
                       << escapeCSV(ipv6.protocol_name)
                       << std::endl;
            }
        }
        else
        {
            // Wrong packet type for this mode, skip
            return true;
        }

        file_->flush();
        return true;
    }
    catch (const std::exception &e)
    {
        last_error_ = std::string("Error writing packet: ") + e.what();
        return false;
    }
}

void DatasetWriter::close()
{
    if (file_ && file_->is_open())
    {
        file_->close();
        std::cout << "Closed CSV output file" << std::endl;
    }
    is_initialized_ = false;
}

std::string DatasetWriter::getLastError() const
{
    return last_error_;
}

void DatasetWriter::writeCSVHeader()
{
    switch (csv_mode_)
    {
    case CSVMode::IPv4_ONLY:
        writeIPv4CSVHeader();
        break;
    case CSVMode::IPv6_ONLY:
        writeIPv6CSVHeader();
        break;
    case CSVMode::BOTH:
        *file_ << "Timestamp,Version,IHL,TOS,TotalLength,Identification,Flags,FragmentOffset,"
               << "TTL,Protocol,HeaderChecksum,SrcIP,DstIP,OptionsHex,TrafficClass,"
               << "FlowLabel,PayloadLength,NextHeader,HopLimit,ExtensionHeaders,ProtocolName" << std::endl;
        break;
    }
}

void DatasetWriter::writeIPv4CSVHeader()
{
    *file_ << "Timestamp,Version,IHL,TOS,TotalLength,Identification,Flags,FragmentOffset,"
           << "TTL,Protocol,HeaderChecksum,SrcIP,DstIP,OptionsHex,ProtocolName" << std::endl;
}

void DatasetWriter::writeIPv6CSVHeader()
{
    *file_ << "Timestamp,Version,TrafficClass,FlowLabel,PayloadLength,NextHeader,"
           << "HopLimit,SrcIP,DstIP,ExtensionHeaders,ProtocolName" << std::endl;
}

std::string DatasetWriter::formatTimestamp(const std::chrono::system_clock::time_point &timestamp)
{
    auto time_t = std::chrono::system_clock::to_time_t(timestamp);
    auto microseconds = std::chrono::duration_cast<std::chrono::microseconds>(
                            timestamp.time_since_epoch()) %
                        1000000;

    std::ostringstream oss;
    oss << std::put_time(std::gmtime(&time_t), "%Y-%m-%d %H:%M:%S");
    oss << "." << std::setfill('0') << std::setw(6) << microseconds.count();
    return oss.str();
}

std::string DatasetWriter::vectorToHex(const std::vector<uint8_t> &data)
{
    if (data.empty())
    {
        return "";
    }

    std::ostringstream oss;
    for (size_t i = 0; i < data.size(); ++i)
    {
        oss << std::hex << std::setfill('0') << std::setw(2) << static_cast<unsigned>(data[i]);
    }
    return oss.str();
}

std::string DatasetWriter::vectorToString(const std::vector<std::string> &data)
{
    if (data.empty())
    {
        return "";
    }

    std::ostringstream oss;
    for (size_t i = 0; i < data.size(); ++i)
    {
        if (i > 0)
            oss << ";";
        oss << data[i];
    }
    return oss.str();
}

std::string DatasetWriter::escapeCSV(const std::string &field)
{
    if (field.find(',') != std::string::npos ||
        field.find('"') != std::string::npos ||
        field.find('\n') != std::string::npos)
    {

        std::string escaped = "\"";
        for (char c : field)
        {
            if (c == '"')
            {
                escaped += "\"\"";
            }
            else
            {
                escaped += c;
            }
        }
        escaped += "\"";
        return escaped;
    }
    return field;
}