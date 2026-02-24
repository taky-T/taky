import sys
import os
import cv2
import numpy as np
import shutil

# Lite Mode: Memory-efficient Video Processing
# This version avoids heavy AI binaries to fit within Render's 512MB limit.

def apply_beauty_filter(frame):
    # Bilateral filter for skin smoothing while keeping edges
    smooth = cv2.bilateralFilter(frame, 9, 75, 75)
    # Slight color enhancement
    hsv = cv2.cvtColor(smooth, cv2.COLOR_BGR2HSV)
    hsv[:,:,1] = cv2.multiply(hsv[:,:,1], 1.2) # Increase saturation
    return cv2.cvtColor(hsv, cv2.COLOR_HSV2BGR)

def apply_video_filter(frame):
    # Cinematic Lookup-Table style filter (Warm)
    increase_red = np.array([0, 0, 1.2]) 
    hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
    hsv[:,:,1] = cv2.multiply(hsv[:,:,1], 1.1)
    frame = cv2.cvtColor(hsv, cv2.COLOR_HSV2BGR)
    # Warm tint
    frame = cv2.addWeighted(frame, 0.9, np.full(frame.shape, (20, 40, 60), np.uint8), 0.1, 0)
    return frame

def process_video(input_video, output_video, type_str):
    print(f"Lite Mode: Processing {type_str} for {input_video}...")
    
    cap = cv2.VideoCapture(input_video)
    if not cap.isOpened():
        raise Exception("Could not open input video")

    fps = cap.get(cv2.CAP_PROP_FPS)
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    
    # Define output dimensions based on type
    if type_str == "4k-upscale":
        target_width, target_height = 3840, 2160
    else:
        target_width, target_height = width, height

    # Use a more compressed codec for small server storage
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    out = cv2.VideoWriter(output_video, fourcc, fps, (target_width, target_height))

    frame_count = 0
    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break

        # Apply transformations
        if type_str == "4k-upscale":
            # High-quality Lanczos interpolation
            frame = cv2.resize(frame, (target_width, target_height), interpolation=cv2.INTER_LANCZOS4)
            # Sharpening mask
            gaussian_blur = cv2.GaussianBlur(frame, (0, 0), 3)
            frame = cv2.addWeighted(frame, 1.5, gaussian_blur, -0.5, 0)
        elif type_str == "beauty-filter":
            frame = apply_beauty_filter(frame)
        elif type_str == "video-filter":
            frame = apply_video_filter(frame)

        out.write(frame)
        frame_count += 1
        
        if frame_count % 30 == 0:
            print(f"Processed {frame_count} frames...")

    cap.release()
    out.release()
    print(f"Success: Processed {frame_count} frames. Saved to {output_video}")

if __name__ == "__main__":
    if len(sys.argv) < 4:
        print("Usage: python upscale.py <input> <output> <type>")
        sys.exit(1)
        
    input_vid = sys.argv[1]
    output_vid = sys.argv[2]
    filter_type = sys.argv[3]
    
    try:
        process_video(input_vid, output_vid, filter_type)
    except Exception as e:
        print(f"Error during processing: {e}")
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) < 4:
        print("Usage: python upscale.py <input_video_path> <output_video_path> <type>")
        sys.exit(1)
        
    input_vid = sys.argv[1]
    output_vid = sys.argv[2]
    filter_type = sys.argv[3]
    
    process_video(input_vid, output_vid, filter_type)
