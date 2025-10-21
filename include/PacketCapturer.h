#pragma once

#include <string>
#include <functional>
#include <memory>

#ifdef _WIN32
#include <pcap.h>
#else
#include <pcap/pcap.h>
#endif

class PacketCapturer
{
public:
    using PacketCallback = std::function<void(const uint8_t *, int, const struct pcap_pkthdr *)>;

    PacketCapturer();
    ~PacketCapturer();

    bool initialize(const std::string &interface_name = "");
    bool setFilter(const std::string &filter);
    void setCallback(PacketCallback callback);
    bool startCapture();
    void stopCapture();

    std::string selectInterfaceInteractively();
    std::string getLastError() const;

private:
    pcap_t *pcap_handle_;
    std::string last_error_;
    PacketCallback packet_callback_;
    bool is_capturing_;

    static void packetHandler(uint8_t *user_data, const struct pcap_pkthdr *header, const uint8_t *packet);
    std::string selectInterface();
};