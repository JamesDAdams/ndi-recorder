#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <signal.h>
#include <Processing.NDI.Lib.h>

static volatile sig_atomic_t g_keep_running = 1;

static void handle_signal(int sig) {
    (void)sig;
    g_keep_running = 0;
}

int main(int argc, char* argv[]) {
    if (!NDIlib_initialize()) {
        fprintf(stderr, "Cannot initialize NDI SDK.\n");
        return 1;
    }

    if (argc > 1 && strcmp(argv[1], "--find") == 0) {
        NDIlib_find_instance_t pNDI_find = NDIlib_find_create_v2(NULL);
        if (!pNDI_find) {
            fprintf(stderr, "Failed to create NDI find instance.\n");
            return 1;
        }

        NDIlib_find_wait_for_sources(pNDI_find, 2000);
        uint32_t no_sources = 0;
        const NDIlib_source_t* p_sources = NDIlib_find_get_current_sources(pNDI_find, &no_sources);

        for (uint32_t i = 0; i < no_sources; i++) {
            printf("%s\n", p_sources[i].p_ndi_name);
        }

        NDIlib_find_destroy(pNDI_find);
        NDIlib_destroy();
        return 0;
    }

    if (argc < 2) {
        fprintf(stderr, "Usage: ndi_capture [--find | [--stream] \"source name\"]\n");
        fprintf(stderr, "  --find                    list NDI sources on the network\n");
        fprintf(stderr, "  \"source name\"             capture one raw BGRA frame from the source\n");
        fprintf(stderr, "  --stream \"source name\"   continuously capture raw BGRA frames to stdout\n");
        NDIlib_destroy();
        return 2;
    }

    int is_stream = 0;
    const char* source_name = argv[1];

    if (strcmp(argv[1], "--stream") == 0) {
        if (argc < 3) {
            fprintf(stderr, "Usage: ndi_capture --stream \"source name\"\n");
            NDIlib_destroy();
            return 2;
        }
        is_stream = 1;
        source_name = argv[2];
    }

    signal(SIGINT, handle_signal);
    signal(SIGTERM, handle_signal);
#ifndef _WIN32
    signal(SIGPIPE, SIG_IGN);
#endif

    NDIlib_source_t target_source;
    target_source.p_ndi_name = source_name;
    target_source.p_url_address = NULL;

    NDIlib_recv_create_v3_t recv_create_desc;
    memset(&recv_create_desc, 0, sizeof(recv_create_desc));
    recv_create_desc.source_to_connect_to = target_source;
    recv_create_desc.color_format = NDIlib_recv_color_format_BGRX_BGRA;
    recv_create_desc.bandwidth = NDIlib_recv_bandwidth_highest;
    recv_create_desc.allow_video_fields = false;

    NDIlib_recv_instance_t pNDI_recv = NDIlib_recv_create_v3(&recv_create_desc);
    if (!pNDI_recv) {
        fprintf(stderr, "Failed to create NDI receiver.\n");
        NDIlib_destroy();
        return 1;
    }

    NDIlib_video_frame_v2_t video_frame;
    NDIlib_audio_frame_v3_t audio_frame;
    NDIlib_metadata_frame_t metadata_frame;

    int captured = 0;
    int res_announced = 0;
    int stream_error = 0;
    int max_attempts = is_stream ? 0 : 50;
    uint32_t timeout_ms = is_stream ? 20 : 100;
    int attempts = 0;

    for (;;) {
        if (!g_keep_running) break;
        if (!is_stream && attempts >= max_attempts) break;
        attempts++;

        NDIlib_frame_type_e frame_type = NDIlib_recv_capture_v3(pNDI_recv, &video_frame, &audio_frame, &metadata_frame, timeout_ms);
        if (frame_type == NDIlib_frame_type_video) {
            if (!res_announced) {
                fprintf(stderr, "RES %dx%d\n", video_frame.xres, video_frame.yres);
                fflush(stderr);
                res_announced = 1;
            }

            size_t row_bytes = video_frame.xres * 4;
            size_t written = 0;

            if (video_frame.line_stride_in_bytes == 0 || video_frame.line_stride_in_bytes == (int)row_bytes) {
                written = fwrite(video_frame.p_data, 1, row_bytes * video_frame.yres, stdout);
            } else {
                for (int y = 0; y < video_frame.yres; y++) {
                    const uint8_t* row = video_frame.p_data + (y * video_frame.line_stride_in_bytes);
                    written += fwrite(row, 1, row_bytes, stdout);
                }
            }

            if (fflush(stdout) != 0 || ferror(stdout)) {
                NDIlib_recv_free_video_v2(pNDI_recv, &video_frame);
                captured = 1;
                stream_error = 1;
                break;
            }
            NDIlib_recv_free_video_v2(pNDI_recv, &video_frame);
            captured = 1;
            if (!is_stream || written == 0) break;
        } else if (frame_type == NDIlib_frame_type_audio) {
            NDIlib_recv_free_audio_v3(pNDI_recv, &audio_frame);
        } else if (frame_type == NDIlib_frame_type_metadata) {
            NDIlib_recv_free_metadata(pNDI_recv, &metadata_frame);
        } else if (frame_type == NDIlib_frame_type_error) {
            fprintf(stderr, "NDI source error (frame_type_error) for source: %s\n", source_name);
            stream_error = 1;
            break;
        }
    }

    NDIlib_recv_destroy(pNDI_recv);
    NDIlib_destroy();

    if (!g_keep_running) {
        fprintf(stderr, "Capture interrupted by signal.\n");
    } else if (!captured) {
        if (is_stream) {
            fprintf(stderr, "Stream ended without capturing any frames from source: %s\n", source_name);
        } else {
            fprintf(stderr, "Frame capture timed out for source: %s\n", source_name);
        }
    }
    return (captured && !stream_error) ? 0 : 1;
}
