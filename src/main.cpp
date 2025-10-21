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
#include <optional>

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

    // Defaults and simple CLI parsing
    std::string output_filename = "packet_capture.csv";
    std::string interface_arg = "";
    IPVersionFilter ip_filter = IPVersionFilter::BOTH;
    int duration_seconds = 0; // 0 => run until stopped

    if (argc >= 2) output_filename = argv[1];
    if (argc >= 3) interface_arg = argv[2];
    if (argc >= 4) {
        std::string f = argv[3];
        if (f == "ipv4") ip_filter = IPVersionFilter::IPv4_ONLY;
        else if (f == "ipv6") ip_filter = IPVersionFilter::IPv6_ONLY;
        else if (f == "icmp") ip_filter = IPVersionFilter::ICMP_ONLY;
        else ip_filter = IPVersionFilter::BOTH;
    }
    if (argc >= 5) {
        try { duration_seconds = std::stoi(argv[4]); } catch(...) { duration_seconds = 0; }
    }

    // Setup components
    auto capturer = std::make_unique<PacketCapturer>();
    auto parser = std::make_unique<PacketParser>();
    CSVMode csv_mode = CSVMode::BOTH;
    switch (ip_filter) {
        case IPVersionFilter::IPv4_ONLY: csv_mode = CSVMode::IPv4_ONLY; break;
        case IPVersionFilter::IPv6_ONLY: csv_mode = CSVMode::IPv6_ONLY; break;
        default: csv_mode = CSVMode::BOTH; break;
    }
    auto writer = std::make_unique<DatasetWriter>(output_filename, csv_mode);

    // Choose interface - empty or "auto" triggers auto-selection in initialize()
    std::string interface_name = (interface_arg.empty() || interface_arg == "auto") ? "" : interface_arg;

    if (!capturer->initialize(interface_name)) {
        std::cerr << "Failed to initialize packet capturer: " << capturer->getLastError() << std::endl;
        return 1;
    }

    if (!writer->initialize()) {
        std::cerr << "Failed to initialize dataset writer: " << writer->getLastError() << std::endl;
        return 1;
    }

    std::string filter_string = getIPVersionFilterString(ip_filter);
    if (!capturer->setFilter(filter_string)) {
        std::cerr << "Failed to set packet filter: " << capturer->getLastError() << std::endl;
        return 1;
    }

    uint64_t packet_count = 0;
    uint64_t processed_count = 0;
    uint64_t dropped_count = 0;
    auto start_time = std::chrono::steady_clock::now();

    capturer->setCallback([&](const uint8_t *packet, int size, const struct pcap_pkthdr *header) {
        if (!keep_running) return;
        packet_count++;

        auto feature = parser->processPacket(packet, size, header);
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
        }
    });

    std::cout << "Starting packet capture. Press Ctrl+C to stop." << std::endl;
    std::cout << "Output file: " << output_filename << std::endl;
    std::cout << "\n*** IMPORTANT ***" << std::endl;
    std::cout << "If no packets are captured:" << std::endl;
    std::cout << "1. Make sure you're running as Administrator (required for packet capture)" << std::endl;
    std::cout << "2. Generate network traffic (browse web, ping, etc.) during capture" << std::endl;
    std::cout << "3. Check if Npcap service is running: 'sc query npcap'" << std::endl;
    std::cout << "4. Ensure Npcap is in 'WinPcap Compatible Mode' during installation" << std::endl;
    std::cout << "*****************\n" << std::endl;

    bool capture_ok = true;
    if (duration_seconds > 0) {
        std::thread capture_thread([&]() {
            if (!capturer->startCapture()) {
                std::cerr << "Failed to start capture: " << capturer->getLastError() << std::endl;
                capture_ok = false;
            }
        });

        for (int i = 0; i < duration_seconds && keep_running; ++i) {
            std::this_thread::sleep_for(std::chrono::seconds(1));
        }

        keep_running = false;
        capturer->stopCapture();
        if (capture_thread.joinable()) capture_thread.join();
    } else {
        if (!capturer->startCapture()) {
            std::cerr << "Failed to start capture: " << capturer->getLastError() << std::endl;
            return 1;
        }
    }

    // Wait a moment for cleanup after Ctrl+C
    if (!keep_running) {
        std::cout << "Exiting..." << std::endl;
        std::this_thread::sleep_for(std::chrono::seconds(1));
    }

    writer->close();

    auto total_elapsed = std::chrono::steady_clock::now() - start_time;
    auto total_elapsed_sec = std::chrono::duration_cast<std::chrono::seconds>(total_elapsed).count();
    double avg_pps = total_elapsed_sec > 0 ? static_cast<double>(processed_count) / total_elapsed_sec : 0;

    std::cout << "\n=== CAPTURE SUMMARY ===" << std::endl;
    std::cout << "Total packets captured: " << packet_count << std::endl;
    std::cout << "Packets processed: " << processed_count << std::endl;
    std::cout << "Packets dropped: " << dropped_count << std::endl;
    std::cout << "Success rate: " << std::fixed << std::setprecision(1)
              << (packet_count > 0 ? (100.0 * processed_count / packet_count) : 0) << "%" << std::endl;
    std::cout << "Capture duration: " << total_elapsed_sec << " seconds" << std::endl;
    std::cout << "Average rate: " << std::fixed << std::setprecision(1) << avg_pps << " packets/sec" << std::endl;
    std::cout << "Output saved to: " << output_filename << std::endl;

    return capture_ok ? 0 : 1;
}