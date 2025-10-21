cmake_minimum_required(VERSION 3.15)
project(NetworkPacketAnalyzer)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Find Npcap/WinPcap
if(WIN32)
    find_path(PCAP_INCLUDE_DIR pcap.h
        PATHS
        "C:/Program Files/Npcap/SDK/Include"
        "C:/WinPcap/Include"
        "C:/Npcap/SDK/Include"
    )
    
    if(CMAKE_SIZEOF_VOID_P EQUAL 8)
        find_library(PCAP_LIBRARY
            NAMES wpcap
            PATHS
            "C:/Program Files/Npcap/SDK/Lib/x64"
            "C:/WinPcap/Lib/x64"
            "C:/Npcap/SDK/Lib/x64"
        )
    else()
        find_library(PCAP_LIBRARY
            NAMES wpcap
            PATHS
            "C:/Program Files/Npcap/SDK/Lib"
            "C:/WinPcap/Lib"
            "C:/Npcap/SDK/Lib"
        )
    endif()
    
    find_library(PACKET_LIBRARY
        NAMES Packet
        PATHS
        "C:/Program Files/Npcap/SDK/Lib/x64"
        "C:/Program Files/Npcap/SDK/Lib"
        "C:/WinPcap/Lib/x64"  
        "C:/WinPcap/Lib"
        "C:/Npcap/SDK/Lib/x64"
        "C:/Npcap/SDK/Lib"
    )
else()
    find_path(PCAP_INCLUDE_DIR pcap.h)
    find_library(PCAP_LIBRARY pcap)
endif()

if(NOT PCAP_INCLUDE_DIR OR NOT PCAP_LIBRARY)
    if(WIN32)
        message(FATAL_ERROR "Npcap not found. Please install Npcap SDK from https://nmap.org/npcap/")
    else()
        message(FATAL_ERROR "libpcap not found. Please install libpcap development package.")
    endif()
endif()

# Include directories
include_directories(${PCAP_INCLUDE_DIR})
include_directories(${CMAKE_SOURCE_DIR}/include)

# Source files
set(COMMON_SOURCES
    src/PacketCapturer.cpp
    src/PacketParser.cpp
    src/DatasetWriter.cpp
)

# Header files
set(HEADERS
    include/PacketCapturer.h
    include/PacketParser.h
    include/PacketFeature.h
    include/DatasetWriter.h
)

# Create main executable (supports all modes: interactive, API, legacy, --list-interfaces)
add_executable(${PROJECT_NAME} src/main.cpp ${COMMON_SOURCES} ${HEADERS})

# Link libraries
target_link_libraries(${PROJECT_NAME} ${PCAP_LIBRARY})
if(WIN32 AND PACKET_LIBRARY)
    target_link_libraries(${PROJECT_NAME} ${PACKET_LIBRARY})
endif()

# Windows specific settings
if(WIN32)
    target_link_libraries(${PROJECT_NAME} ws2_32)
    target_compile_definitions(${PROJECT_NAME} PRIVATE WIN32_LEAN_AND_MEAN)
    target_compile_definitions(${PROJECT_NAME} PRIVATE WPCAP)
    target_compile_definitions(${PROJECT_NAME} PRIVATE HAVE_REMOTE)
endif()