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
#include <cstring>
#include <filesystem>
#include <system_error>

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
    ALL,
    ICMP_ONLY,
    BGP_ONLY
};

std::string getIPVersionFilterString(IPVersionFilter filter)
{
    switch (filter)
    {
    case IPVersionFilter::IPv4_ONLY:
        return "ip";
    case IPVersionFilter::IPv6_ONLY:
        return "ip6";
    case IPVersionFilter::ALL:
        return "";
    case IPVersionFilter::ICMP_ONLY:
        return "icmp or icmp6";
    case IPVersionFilter::BGP_ONLY:
        return "tcp port 179";
    }
    return "";
}

void printUsage(const char *program_name)
{
    std::cout << "Usage: " << program_name << " [options]" << std::endl;
    std::cout << "\nModes:" << std::endl;
    std::cout << "  --list-interfaces    List all network interfaces in JSON format" << std::endl;
    std::cout << "  (no args)            Interactive mode with prompts" << std::endl;
    std::cout << "\nAPI Format (for web backend):" << std::endl;
    std::cout << "  " << program_name << " <output> <interface> <filter> <duration> [promiscuous] [stopFile]" << std::endl;
    std::cout << "    output      - CSV filename" << std::endl;
    std::cout << "    interface   - 'auto' or device path" << std::endl;
    std::cout << "    filter      - ipv4|ipv6|both|all|icmp|bgp" << std::endl;
    std::cout << "    duration    - seconds (0 = unlimited)" << std::endl;
    std::cout << "    promiscuous - on|off (default: on)" << std::endl;
    std::cout << "    stopFile   - optional path to a stop-signal file" << std::endl;
    std::cout << "\nLegacy Format:" << std::endl;
    std::cout << "  " << program_name << " <output> <type> <promiscuous> [interface]" << std::endl;
    std::cout << "    output      - CSV filename" << std::endl;
    std::cout << "    type        - ipv4|ipv6|all|icmp|bgp" << std::endl;
    std::cout << "    promiscuous - on|off" << std::endl;
    std::cout << "    interface   - device path (optional)" << std::endl;
    std::cout << "\nExamples:" << std::endl;
    std::cout << "  " << program_name << " --list-interfaces" << std::endl;
    std::cout << "  " << program_name << " capture.csv auto both 30 on" << std::endl;
    std::cout << "  " << program_name << " bgp_data.csv auto bgp 60 off" << std::endl;
    std::cout << "  " << program_name << " icmp.csv icmp on" << std::endl;
}

int main(int argc, char *argv[])
{
    // Reset global flag in case of reuse
    keep_running = true;

    // Handle special mode: --list-interfaces (output JSON for API)
    if (argc >= 2 && strcmp(argv[1], "--list-interfaces") == 0)
    {
        PacketCapturer capturer;
        capturer.listInterfacesJSON();
        return 0;
    }

    std::cout << "=== Network Packet Analyzer ===" << std::endl;

    signal(SIGINT, signalHandler);
#ifdef _WIN32
    signal(SIGBREAK, signalHandler);
#endif

    std::string output_filename;
    IPVersionFilter ip_filter;
    bool promiscuous_mode = true;
    std::string interface_name;
    int duration_seconds = 0; // 0 = unlimited
    bool use_interactive = true;
    bool use_api_format = false;
    std::string stop_signal_file;

    // Check if using API format: <output> <interface> <filter> <duration> [promiscuous]
    // vs Legacy format: <output> <type> <promiscuous> [interface]
    if (argc >= 5)
    {
        // Try to detect format by checking if 4th arg is a number (duration for API format)
        try
        {
            duration_seconds = std::stoi(argv[4]);
            use_api_format = true;
            use_interactive = false;
        }
        catch (...)
        {
            // Not a number, likely legacy format or invalid
            use_api_format = false;
        }
    }

    if (argc >= 4 && !use_api_format)
    {
        // Legacy CLI format
        use_interactive = false;
        output_filename = argv[1];

        std::string filter_arg = argv[2];
        if (filter_arg == "ipv4")
            ip_filter = IPVersionFilter::IPv4_ONLY;
        else if (filter_arg == "ipv6")
            ip_filter = IPVersionFilter::IPv6_ONLY;
        else if (filter_arg == "all")
            ip_filter = IPVersionFilter::ALL;
        else if (filter_arg == "icmp")
            ip_filter = IPVersionFilter::ICMP_ONLY;
        else if (filter_arg == "bgp")
            ip_filter = IPVersionFilter::BGP_ONLY;
        else
        {
            std::cerr << "Error: Invalid packet type '" << filter_arg << "'" << std::endl;
            printUsage(argv[0]);
            return 1;
        }

        std::string promisc_arg = argv[3];
        if (promisc_arg == "on")
            promiscuous_mode = true;
        else if (promisc_arg == "off")
            promiscuous_mode = false;
        else
        {
            std::cerr << "Error: Invalid promiscuous mode '" << promisc_arg << "'. Use 'on' or 'off'" << std::endl;
            printUsage(argv[0]);
            return 1;
        }

        if (argc >= 5)
        {
            interface_name = argv[4];
        }
    }
    else if (use_api_format)
    {
        // API format: <output> <interface> <filter> <duration> [promiscuous]
        use_interactive = false;
        output_filename = argv[1];
        interface_name = argv[2];

        std::string filter_arg = argv[3];
        if (filter_arg == "ipv4")
            ip_filter = IPVersionFilter::IPv4_ONLY;
        else if (filter_arg == "ipv6")
            ip_filter = IPVersionFilter::IPv6_ONLY;
        else if (filter_arg == "both" || filter_arg == "all")
            ip_filter = IPVersionFilter::ALL;
        else if (filter_arg == "icmp")
            ip_filter = IPVersionFilter::ICMP_ONLY;
        else if (filter_arg == "bgp")
            ip_filter = IPVersionFilter::BGP_ONLY;
        else
        {
            std::cerr << "Error: Invalid filter '" << filter_arg << "'" << std::endl;
            return 1;
        }

        // duration_seconds already parsed above

        if (argc >= 6)
        {
            std::string promisc_arg = argv[5];
            if (promisc_arg == "on")
                promiscuous_mode = true;
            else if (promisc_arg == "off")
                promiscuous_mode = false;
        }

        if (argc >= 7)
        {
            stop_signal_file = argv[6];
        }
    }
    // Note: Legacy format parsing already handled above in lines 119-155

    if (use_interactive)
    {
        std::cout << "\nEnter output CSV filename (or press Enter for 'packet_capture.csv'): ";
        std::getline(std::cin, output_filename);
        if (output_filename.empty())
        {
            output_filename = "packet_capture.csv";
        }

        std::cout << "\nSelect packet type to capture:" << std::endl;
        std::cout << "1. IPv4 only" << std::endl;
        std::cout << "2. IPv6 only" << std::endl;
        std::cout << "3. All packets" << std::endl;
        std::cout << "4. ICMP only (both IPv4 and IPv6)" << std::endl;
        std::cout << "5. BGP only (TCP port 179)" << std::endl;
        std::cout << "Enter choice (1-5): ";

        int choice;
        std::cin >> choice;
        std::cin.ignore();

        switch (choice)
        {
        case 1:
            ip_filter = IPVersionFilter::IPv4_ONLY;
            break;
        case 2:
            ip_filter = IPVersionFilter::IPv6_ONLY;
            break;
        case 3:
            ip_filter = IPVersionFilter::ALL;
            break;
        case 4:
            ip_filter = IPVersionFilter::ICMP_ONLY;
            break;
        case 5:
            ip_filter = IPVersionFilter::BGP_ONLY;
            break;
        default:
            std::cout << "Invalid choice, defaulting to all packets" << std::endl;
            ip_filter = IPVersionFilter::ALL;
            break;
        }

        std::cout << "\nEnable promiscuous mode?" << std::endl;
        std::cout << "1. Yes (capture all packets on the network)" << std::endl;
        std::cout << "2. No (capture only packets destined for this machine)" << std::endl;
        std::cout << "Enter choice (1-2): ";

        std::cin >> choice;
        std::cin.ignore();

        promiscuous_mode = (choice == 1);
    }

    CSVMode csv_mode;
    switch (ip_filter)
    {
    case IPVersionFilter::IPv4_ONLY:
        csv_mode = CSVMode::IPv4_ONLY;
        break;
    case IPVersionFilter::IPv6_ONLY:
        csv_mode = CSVMode::IPv6_ONLY;
        break;
    case IPVersionFilter::ALL:
    case IPVersionFilter::ICMP_ONLY:
    case IPVersionFilter::BGP_ONLY:
        csv_mode = CSVMode::BOTH;
        break;
    }

    auto capturer = std::make_unique<PacketCapturer>();
    auto handler = std::make_unique<PacketParser>();
    auto writer = std::make_unique<DatasetWriter>(output_filename, csv_mode);

    if (interface_name == "auto")
    {
        // Auto-select: pick first active interface with addresses
        interface_name = capturer->selectFirstActiveInterface();
        if (interface_name.empty())
        {
            std::cerr << "No active network interface found" << std::endl;
            return 1;
        }
        std::cout << "Auto-selected interface: " << interface_name << std::endl;
    }
    else if (use_interactive || interface_name.empty())
    {
        interface_name = capturer->selectInterfaceInteractively();
        if (interface_name.empty())
        {
            std::cerr << "No interface selected or available" << std::endl;
            return 1;
        }
    }

    if (!capturer->initialize(interface_name, promiscuous_mode))
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
    if (!filter_string.empty())
    {
        if (!capturer->setFilter(filter_string))
        {
            std::cerr << "Failed to set packet filter: " << capturer->getLastError() << std::endl;
            return 1;
        }
    }
    else
    {
        std::cout << "No packet filter applied - capturing all packets" << std::endl;
    }

    uint64_t packet_count = 0;
    uint64_t processed_count = 0;
    uint64_t dropped_count = 0;
    auto start_time = std::chrono::steady_clock::now();

    // If a finite duration is requested, also start a timer thread that will
    // break the pcap loop even if no packets arrive (important on idle links).
    std::thread timer_thread;
    if (duration_seconds > 0)
    {
        auto capturer_ptr = capturer.get();
        timer_thread = std::thread([capturer_ptr, &start_time, duration_seconds]()
                                   {
            using namespace std::chrono;
            // Sleep until duration elapses; use steady_clock for monotonic timing
            auto target = steady_clock::now() + seconds(duration_seconds);
            std::this_thread::sleep_until(target);
            // Signal stop and break the loop from another thread
            keep_running = false;
            if (capturer_ptr)
            {
                std::cout << "\n[Timer] Duration reached. Stopping capture..." << std::endl;
                capturer_ptr->stopCapture();
            } });
    }

    std::thread stop_file_thread;
    if (!stop_signal_file.empty())
    {
        auto capturer_ptr = capturer.get();
        stop_file_thread = std::thread([capturer_ptr, stop_signal_file]()
                                       {
            std::filesystem::path signal_path(stop_signal_file);
            while (keep_running)
            {
                if (std::filesystem::exists(signal_path))
                {
                    std::cout << "\n[Stop] External stop signal detected. Stopping capture..." << std::endl;
                    keep_running = false;
                    if (capturer_ptr)
                    {
                        capturer_ptr->stopCapture();
                    }
                    break;
                }
                std::this_thread::sleep_for(std::chrono::milliseconds(200));
            } });
    }

    capturer->setCallback([&](const uint8_t *packet, int size, const struct pcap_pkthdr *header)
                          {
        // Check duration timeout
        if (duration_seconds > 0) {
            auto elapsed = std::chrono::steady_clock::now() - start_time;
            auto elapsed_sec = std::chrono::duration_cast<std::chrono::seconds>(elapsed).count();
            if (elapsed_sec >= duration_seconds) {
                keep_running = false;
                // Also explicitly break the pcap loop to stop immediately
                // even under continuous traffic.
                if (capturer)
                {
                    capturer->stopCapture();
                }
                return;
            }
        }

        if (!keep_running) {
            // Ensure loop is broken if we were signaled to stop
            if (capturer)
            {
                capturer->stopCapture();
            }
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
                    
                    std::string ip_type, protocol_name, src_ip, dst_ip;
                    
                    if (feature->type == PacketFeature::Type::IPv4) {
                        ip_type = "IPv4";
                        protocol_name = feature->ipv4.protocol_name;
                        src_ip = feature->ipv4.src_address;
                        dst_ip = feature->ipv4.dst_address;
                    } else {
                        ip_type = "IPv6";
                        protocol_name = feature->ipv6.protocol_name;
                        src_ip = feature->ipv6.src_address;
                        dst_ip = feature->ipv6.dst_address;
                    }
                    
                    std::cout << "[" << processed_count << "] " << ip_type << "/" << protocol_name
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
        // Join timer thread if it was started
        if (timer_thread.joinable())
        {
            timer_thread.join();
        }
        if (stop_file_thread.joinable())
        {
            stop_file_thread.join();
        }
        return 1;
    }

    bool interrupted = !keep_running.load();
    keep_running = false;

    // Wait a moment for cleanup after Ctrl+C
    if (interrupted)
    {
        std::cout << "Exiting..." << std::endl;
        std::this_thread::sleep_for(std::chrono::seconds(1));
    }

    // Join the timer thread if it was started
    if (timer_thread.joinable())
    {
        timer_thread.join();
    }

    if (stop_file_thread.joinable())
    {
        stop_file_thread.join();
    }

    writer->close();

    if (!stop_signal_file.empty())
    {
        std::error_code ec;
        std::filesystem::remove(stop_signal_file, ec);
    }

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

    return 0;
}