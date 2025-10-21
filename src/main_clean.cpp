#include "PacketCapturer.h"
#include "PacketParser.h"
#include "DatasetWriter.h"
#include <iostream>
#include <signal.h>
#include <memory>
#include <atomic>
#include <chrono>
#include <iomanip>
#include <thread>

std::atomic<bool> keep_running(true);

void signalHandler(int signal)
{
    std::cout << "\nReceived signal " << signal << ". Stopping capture..." << std::endl;
    keep_running = false;
}

enum class IPVersionFilter
{
    IPv4_ONLY,
    IPv6_ONLY,
    BOTH,
    ICMP_ONLY
};

std::string getIPVersionFilterString(IPVersionFilter filter)
{
    switch (filter)
    {
    case IPVersionFilter::IPv4_ONLY:
        return "ip";
    case IPVersionFilter::IPv6_ONLY:
        return "ip6";
    case IPVersionFilter::BOTH:
        return "ip or ip6";
    case IPVersionFilter::ICMP_ONLY:
        return "icmp or icmp6";
    }
    return "ip or ip6";
}

int main(int argc, char *argv[])
{
    std::cout << "=== Network Packet Analyzer ===" << std::endl;

    signal(SIGINT, signalHandler);
#ifdef _WIN32
    signal(SIGBREAK, signalHandler);
#endif

    // Interactive prompts
    std::string output_filename;
    std::cout << "\nEnter output CSV filename (or press Enter for 'packet_capture.csv'): ";
    std::getline(std::cin, output_filename);
    if (output_filename.empty())
    {
        output_filename = "packet_capture.csv";
    }

    IPVersionFilter ip_filter;
    std::cout << "\nSelect packet type to capture:" << std::endl;
    std::cout << "1. IPv4 only" << std::endl;
    std::cout << "2. IPv6 only" << std::endl;
    std::cout << "3. Both IPv4 and IPv6" << std::endl;
    std::cout << "4. ICMP only (both IPv4 and IPv6)" << std::endl;
    std::cout << "Enter choice (1-4): ";

    int choice;
    std::cin >> choice;
    std::cin.ignore(); // Clear the newline

    switch (choice)
    {
    case 1:
        ip_filter = IPVersionFilter::IPv4_ONLY;
        break;
    case 2:
        ip_filter = IPVersionFilter::IPv6_ONLY;
        break;
    case 3:
        ip_filter = IPVersionFilter::BOTH;
        break;
    case 4:
        ip_filter = IPVersionFilter::ICMP_ONLY;
        break;
    default:
        std::cout << "Invalid choice, defaulting to both IPv4 and IPv6" << std::endl;
        ip_filter = IPVersionFilter::BOTH;
        break;
    }

    // Determine CSV mode based on IP filter selection
    CSVMode csv_mode;
    switch (ip_filter)
    {
    case IPVersionFilter::IPv4_ONLY:
        csv_mode = CSVMode::IPv4_ONLY;
        break;
    case IPVersionFilter::IPv6_ONLY:
        csv_mode = CSVMode::IPv6_ONLY;
        break;
    case IPVersionFilter::BOTH:
        csv_mode = CSVMode::BOTH;
        break;
    case IPVersionFilter::ICMP_ONLY:
        csv_mode = CSVMode::BOTH;  // Use BOTH mode since ICMP can be either v4 or v6
        break;
    }

    auto capturer = std::make_unique<PacketCapturer>();
    auto handler = std::make_unique<PacketParser>();
    auto writer = std::make_unique<DatasetWriter>(output_filename, csv_mode);

    // Interactive interface selection
    std::string interface_name = capturer->selectInterfaceInteractively();
    if (interface_name.empty())
    {
        std::cerr << "No interface selected or available" << std::endl;
        return 1;
    }

    if (!capturer->initialize(interface_name))
    {
        std::cerr << "Failed to initialize packet capturer: " << capturer->getLastError() << std::endl;
        return 1;
    }

    if (!writer->initialize())
    {
        std::cerr << "Failed to initialize dataset writer: " << writer->getLastError() << std::endl;
        return 1;
    }

    std::string filter_string = getIPVersionFilterString(ip_filter);
    if (!capturer->setFilter(filter_string))
    {
        std::cerr << "Failed to set packet filter: " << capturer->getLastError() << std::endl;
        return 1;
    }

    uint64_t packet_count = 0;
    uint64_t processed_count = 0;
    uint64_t dropped_count = 0;
    auto start_time = std::chrono::steady_clock::now();

    capturer->setCallback([&](const uint8_t *packet, int size, const struct pcap_pkthdr *header)
                          {
        if (!keep_running) {
            return;
        }
        
        packet_count++;
        
        auto feature = handler->processPacket(packet, size, header);
        if (feature) {
            if (writer->writePacket(*feature)) {
                processed_count++;
                
                if (processed_count % 5 == 0) {
                    auto elapsed = std::chrono::steady_clock::now() - start_time;
                    auto elapsed_sec = std::chrono::duration_cast<std::chrono::seconds>(elapsed).count();
                    double pps = elapsed_sec > 0 ? static_cast<double>(processed_count) / elapsed_sec : 0;
                    
                    std::string ip_type = (feature->type == PacketFeature::Type::IPv4) ? "IPv4" : "IPv6";
                    std::string src_ip, dst_ip;
                    
                    if (feature->type == PacketFeature::Type::IPv4) {
                        src_ip = feature->ipv4.src_address;
                        dst_ip = feature->ipv4.dst_address;
                    } else {
                        src_ip = feature->ipv6.src_address;
                        dst_ip = feature->ipv6.dst_address;
                    }
                    
                    std::cout << "[" << processed_count << "] " << ip_type 
                              << " | " << src_ip << " -> " << dst_ip 
                              << " | Size: " << header->len << " bytes"
                              << " | Rate: " << std::fixed << std::setprecision(1) << pps << " pps"
                              << " | Total captured: " << packet_count << std::endl;
                }
                
                if (processed_count % 100 == 0) {
                    std::cout << "=== Milestone: " << processed_count << " packets processed ===" << std::endl;
                }
            } else {
                std::cerr << "Failed to write packet: " << writer->getLastError() << std::endl;
            }
        } else {
            dropped_count++;
            if (dropped_count % 50 == 0) {
                std::cout << "Warning: " << dropped_count << " packets dropped (parsing failed or non-IP)" << std::endl;
            }
        } });

    std::cout << "Starting packet capture. Press Ctrl+C to stop." << std::endl;
    std::cout << "Output file: " << output_filename << std::endl;

    if (!capturer->startCapture())
    {
        std::cerr << "Failed to start capture: " << capturer->getLastError() << std::endl;
        return 1;
    }

    // Wait a moment for cleanup after Ctrl+C
    if (!keep_running)
    {
        std::cout << "Exiting..." << std::endl;
        std::this_thread::sleep_for(std::chrono::seconds(1));
    }

    writer->close();

    auto total_elapsed = std::chrono::steady_clock::now() - start_time;
        auto capturer = std::make_unique<PacketCapturer>();
    double avg_pps = total_elapsed_sec > 0 ? static_cast<double>(processed_count) / total_elapsed_sec : 0;

    std::cout << "\n=== CAPTURE SUMMARY ===" << std::endl;
    std::cout << "Total packets captured: " << packet_count << std::endl;
        std::string interface_arg = "";
        int duration_seconds = 0; // 0 means run until interrupted

        // Simple CLI parsing: [output] [interface] [filter] [duration]
        // filter: "ipv4", "ipv6", "both", "icmp"
        if (argc >= 2)
        {
            output_filename = argv[1];
        }
        if (argc >= 3)
        {
            interface_arg = argv[2];
        }
        if (argc >= 4)
        {
            std::string f = argv[3];
            if (f == "ipv4") ip_filter = IPVersionFilter::IPv4_ONLY;
            else if (f == "ipv6") ip_filter = IPVersionFilter::IPv6_ONLY;
            else if (f == "icmp") ip_filter = IPVersionFilter::ICMP_ONLY;
            else ip_filter = IPVersionFilter::BOTH;
        }
        if (argc >= 5)
        {
            try {
                duration_seconds = std::stoi(argv[4]);
            } catch (...) { duration_seconds = 0; }
        }
        std::string interface_name = interface_arg.empty() ? capturer->selectInterfaceInteractively() : interface_arg;
        if (interface_name.empty())
        {
            std::cerr << "No interface selected or available" << std::endl;
            return 1;
        }

        if (!capturer->initialize(interface_name))
    return 0;
}