#pragma once

#include "PacketFeature.h"
#include <string>
#include <fstream>
#include <memory>

enum class CSVMode {
    BOTH,     // Mixed IPv4/IPv6 with all columns
    IPv4_ONLY, // IPv4 columns only
    IPv6_ONLY  // IPv6 columns only
};

class DatasetWriter {
public:
    DatasetWriter(const std::string& filename, CSVMode mode = CSVMode::BOTH);
    ~DatasetWriter();
    
    bool initialize();
    bool writePacket(const PacketFeature& packet);
    void close();
    
    std::string getLastError() const;
    
private:
    std::string filename_;
    std::unique_ptr<std::ofstream> file_;
    std::string last_error_;
    bool is_initialized_;
    CSVMode csv_mode_;
    
    void writeCSVHeader();
    void writeIPv4CSVHeader();
    void writeIPv6CSVHeader();
    std::string formatTimestamp(const std::chrono::system_clock::time_point& timestamp);
    std::string vectorToHex(const std::vector<uint8_t>& data);
    std::string vectorToString(const std::vector<std::string>& data);
    std::string escapeCSV(const std::string& field);
};