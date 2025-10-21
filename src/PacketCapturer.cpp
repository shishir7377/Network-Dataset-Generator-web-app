#include "PacketCapturer.h"
#include <iostream>
#include <cstring>
#include <vector>

#ifdef _WIN32
#include <winsock2.h>
#include <ws2tcpip.h>
#endif

PacketCapturer::PacketCapturer() : pcap_handle_(nullptr), is_capturing_(false)
{
#ifdef _WIN32
    WSADATA wsa_data;
    WSAStartup(MAKEWORD(2, 2), &wsa_data);
#endif
}

PacketCapturer::~PacketCapturer()
{
    stopCapture();
    if (pcap_handle_)
    {
        pcap_close(pcap_handle_);
    }
#ifdef _WIN32
    WSACleanup();
#endif
}

bool PacketCapturer::initialize(const std::string &interface_name)
{
    char errbuf[PCAP_ERRBUF_SIZE];
    std::string device_name = interface_name;

    if (device_name.empty())
    {
        device_name = selectInterface();
        if (device_name.empty())
        {
            last_error_ = "No suitable network interface found";
            return false;
        }
    }

    pcap_handle_ = pcap_open_live(device_name.c_str(), 65536, 1, 10, errbuf);
    if (!pcap_handle_)
    {
        last_error_ = std::string("Failed to open device: ") + errbuf;
        return false;
    }

#ifdef _WIN32
    if (pcap_setbuff(pcap_handle_, 16777216) != 0)
    {
        std::cout << "Warning: Could not set buffer size: " << pcap_geterr(pcap_handle_) << std::endl;
    }

    if (pcap_setmintocopy(pcap_handle_, 1) != 0)
    {
        std::cout << "Warning: Could not set min to copy: " << pcap_geterr(pcap_handle_) << std::endl;
    }
#endif

    int datalink = pcap_datalink(pcap_handle_);
    if (datalink != DLT_EN10MB)
    {
        last_error_ = "Interface does not provide Ethernet headers";
        pcap_close(pcap_handle_);
        pcap_handle_ = nullptr;
        return false;
    }

    std::cout << "Initialized packet capture on interface: " << device_name << std::endl;
    return true;
}

bool PacketCapturer::setFilter(const std::string &filter)
{
    if (!pcap_handle_)
    {
        last_error_ = "Capturer not initialized";
        return false;
    }

    struct bpf_program fp;
    char errbuf[PCAP_ERRBUF_SIZE];

    if (pcap_compile(pcap_handle_, &fp, filter.c_str(), 0, PCAP_NETMASK_UNKNOWN) == -1)
    {
        last_error_ = std::string("Failed to compile filter: ") + pcap_geterr(pcap_handle_);
        return false;
    }

    if (pcap_setfilter(pcap_handle_, &fp) == -1)
    {
        last_error_ = std::string("Failed to set filter: ") + pcap_geterr(pcap_handle_);
        pcap_freecode(&fp);
        return false;
    }

    pcap_freecode(&fp);
    std::cout << "Set packet filter: " << filter << std::endl;
    return true;
}

void PacketCapturer::setCallback(PacketCallback callback)
{
    packet_callback_ = callback;
}

bool PacketCapturer::startCapture()
{
    if (!pcap_handle_ || !packet_callback_)
    {
        last_error_ = "Capturer not properly initialized or callback not set";
        return false;
    }

    is_capturing_ = true;
    std::cout << "Starting packet capture..." << std::endl;

    int result = pcap_loop(pcap_handle_, -1, packetHandler, reinterpret_cast<uint8_t *>(this));

    if (result == -1)
    {
        last_error_ = std::string("Capture error: ") + pcap_geterr(pcap_handle_);
        return false;
    }

    return true;
}

void PacketCapturer::stopCapture()
{
    if (pcap_handle_ && is_capturing_)
    {
        is_capturing_ = false;
        pcap_breakloop(pcap_handle_);
        std::cout << "Stopping packet capture..." << std::endl;
    }
}

std::string PacketCapturer::getLastError() const
{
    return last_error_;
}

void PacketCapturer::packetHandler(uint8_t *user_data, const struct pcap_pkthdr *header, const uint8_t *packet)
{
    PacketCapturer *capturer = reinterpret_cast<PacketCapturer *>(user_data);
    if (capturer && capturer->packet_callback_)
    {
        capturer->packet_callback_(packet, header->caplen, header);
    }
}

std::string PacketCapturer::selectInterface()
{
    pcap_if_t *all_devices;
    char errbuf[PCAP_ERRBUF_SIZE];

    if (pcap_findalldevs(&all_devices, errbuf) == -1)
    {
        last_error_ = std::string("Error finding devices: ") + errbuf;
        return "";
    }

    std::cout << "Available network interfaces:" << std::endl;
    std::string selected_device;
    int interface_count = 0;

    for (pcap_if_t *device = all_devices; device != nullptr; device = device->next)
    {
        interface_count++;
        std::cout << "  " << interface_count << ". " << device->name;
        if (device->description)
        {
            std::cout << " (" << device->description << ")";
        }

        if (device->flags & PCAP_IF_LOOPBACK)
        {
            std::cout << " [LOOPBACK - SKIPPED]";
        }
        else if (device->flags & PCAP_IF_UP)
        {
            std::cout << " [UP]";
        }
        else
        {
            std::cout << " [DOWN]";
        }

        if (device->addresses)
        {
            std::cout << " [HAS_ADDRESSES]";
        }
        std::cout << std::endl;

        if (selected_device.empty() && !(device->flags & PCAP_IF_LOOPBACK) &&
            (device->flags & PCAP_IF_UP) && device->addresses != nullptr)
        {
            selected_device = device->name;
            std::cout << "  -> SELECTED as capture interface" << std::endl;
        }
    }

    pcap_freealldevs(all_devices);
    return selected_device;
}

std::string PacketCapturer::selectInterfaceInteractively()
{
    pcap_if_t *all_devices;
    char errbuf[PCAP_ERRBUF_SIZE];

    if (pcap_findalldevs(&all_devices, errbuf) == -1)
    {
        last_error_ = std::string("Error finding devices: ") + errbuf;
        return "";
    }

    std::cout << "\n=== NETWORK INTERFACE SELECTION ===" << std::endl;
    std::cout << "Available network interfaces:" << std::endl;

    std::vector<std::string> interface_names;
    int interface_count = 0;

    for (pcap_if_t *device = all_devices; device != nullptr; device = device->next)
    {
        interface_count++;
        interface_names.push_back(device->name);

        std::cout << "\n"
                  << interface_count << ". ";

        if (device->description)
        {
            std::cout << device->description;
        }
        else
        {
            std::cout << device->name;
        }

        std::cout << "\n   Device: " << device->name;

        std::string status = "";
        if (device->flags & PCAP_IF_LOOPBACK)
        {
            status += "[LOOPBACK] ";
        }
        if (device->flags & PCAP_IF_UP)
        {
            status += "[UP] ";
        }
        else
        {
            status += "[DOWN] ";
        }
        if (device->addresses)
        {
            status += "[HAS_ADDRESSES] ";
        }
        if (device->flags & PCAP_IF_WIRELESS)
        {
            status += "[WIRELESS] ";
        }
        if (device->flags & PCAP_IF_RUNNING)
        {
            status += "[RUNNING] ";
        }

        std::cout << "\n   Status: " << status;

        if (device->addresses)
        {
            for (pcap_addr_t *addr = device->addresses; addr != nullptr; addr = addr->next)
            {
                if (addr->addr && addr->addr->sa_family == AF_INET)
                {
                    struct sockaddr_in *sin = (struct sockaddr_in *)addr->addr;
                    std::cout << "\n   IPv4: " << inet_ntoa(sin->sin_addr);
                    break;
                }
            }
        }

        if (device->description &&
            (strstr(device->description, "Wi-Fi") ||
             strstr(device->description, "Wireless") ||
             strstr(device->description, "WiFi") ||
             strstr(device->description, "802.11")))
        {
            std::cout << " *** WIRELESS ADAPTER ***";
        }

        if (device->description &&
            (strstr(device->description, "VMware") ||
             strstr(device->description, "VirtualBox") ||
             strstr(device->description, "Hyper-V")))
        {
            std::cout << " [VIRTUAL - NOT RECOMMENDED]";
        }
    }

    std::cout << "\n\nEnter the number of the interface to use (1-" << interface_count << "): ";

    int choice;
    std::cin >> choice;

    std::string selected_interface;
    if (choice >= 1 && choice <= interface_count)
    {
        selected_interface = interface_names[choice - 1];
        std::cout << "Selected interface: " << selected_interface << std::endl;
    }
    else
    {
        std::cout << "Invalid choice. Using auto-selection..." << std::endl;
        selected_interface = selectInterface();
    }

    pcap_freealldevs(all_devices);
    return selected_interface;
}