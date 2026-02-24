import sys
import os
import cv2
import subprocess
import requests
import zipfile
import shutil

# This script downloads and utilizes the portable Real-ESRGAN-ncnn-vulkan executable.
# It extracts frames from the video, runs the executable on the frames, and stitches them back.

def download_realesrgan(bin_dir):
    is_win = sys.platform == "win32"
    url = "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.5.0/realesrgan-ncnn-vulkan-20220424-windows.zip" if is_win else \
          "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.5.0/realesrgan-ncnn-vulkan-20220424-ubuntu.zip"
    
    zip_path = os.path.join(bin_dir, "realesrgan.zip")
    exe_name = "realesrgan-ncnn-vulkan.exe" if is_win else "realesrgan-ncnn-vulkan"
    
    if os.path.exists(os.path.join(bin_dir, exe_name)):
        return

    print("Downloading Real-ESRGAN executable...")
    os.makedirs(bin_dir, exist_ok=True)
    response = requests.get(url, stream=True)
    with open(zip_path, 'wb') as f:
        for chunk in response.iter_content(chunk_size=8192):
            f.write(chunk)
    
    print("Extracting Real-ESRGAN...")
    with zipfile.ZipFile(zip_path, 'r') as zip_ref:
        zip_ref.extractall(bin_dir)
    os.remove(zip_path)

def process_video(input_video, output_video, type_str):
    bin_dir = os.path.join(os.path.dirname(__file__), 'bin')
    download_realesrgan(bin_dir)
    
    is_win = sys.platform == "win32"
    executable = os.path.join(bin_dir, "realesrgan-ncnn-vulkan.exe" if is_win else "realesrgan-ncnn-vulkan")
    
    # On Linux, we need to make the binary executable
    if not is_win:
        os.chmod(executable, 0o755)
    frames_dir = os.path.join(os.path.dirname(input_video), 'temp_frames')
    out_frames_dir = os.path.join(os.path.dirname(input_video), 'temp_out_frames')
    
    os.makedirs(frames_dir, exist_ok=True)
    os.makedirs(out_frames_dir, exist_ok=True)
    
    print(f"Extracting frames from {input_video}...")
    cap = cv2.VideoCapture(input_video)
    fps = cap.get(cv2.CAP_PROP_FPS)
    frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    
    count = 0
    while cap.isOpened():
        ret, frame = cap.read()
        if not ret or frame is None:
            break
        cv2.imwrite(os.path.join(frames_dir, f"{count:08d}.jpg"), frame)
        count += 1
    cap.release()
    
    if count == 0:
        print("Error: Could not extract any frames. The input file might not be a valid video or is corrupted.")
        raise Exception("Frame extraction failed")
    print(f"Extracted {count} frames. Running Real-ESRGAN AI (This will take a very long time)...")
    
    # Define model based on type (RealESRGAN has different models, we'll use a generic one for now)
    model_name = "realesr-animevideov3" if type_str in ["beauty-filter", "video-filter"] else "realesrgan-x4plus"
    scale = "2" if type_str in ["beauty-filter", "video-filter"] else "4"
    
    # Run the ncnn-vulkan executable on the directory
    # It automatically processes all images in the input dir and saves to output dir
    cmd = [
        executable,
        "-i", frames_dir,
        "-o", out_frames_dir,
        "-n", model_name,
        "-s", scale,
        "-f", "jpg"
    ]
    
    print(f"Executing: {' '.join(cmd)}")
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, cwd=bin_dir)
        if result.returncode != 0:
            print("Error upscaling (Real-ESRGAN failed):")
            print("STDOUT:", result.stdout)
            print("STDERR:", result.stderr)
            raise Exception("Real-ESRGAN failed")
        
        print("Upscaling complete (AI).")
        
        first_frame_path = os.path.join(out_frames_dir, "00000000.jpg")
        if not os.path.exists(first_frame_path):
            raise Exception("No output frames found")
            
    except Exception as e:
        print(f"AI Scaling failed or not supported on this hardware: {e}")
        print("Falling back to high-quality OpenCV scaling...")
        
        # High quality fallback: Bicubic Interpolation + Unsharp Mask
        for i in range(count):
            frame_path = os.path.join(frames_dir, f"{i:08d}.jpg")
            out_path = os.path.join(out_frames_dir, f"{i:08d}.jpg")
            frame = cv2.imread(frame_path)
            
            # Upscale
            h, w = frame.shape[:2]
            target_scale = int(scale)
            new_size = (w * target_scale, h * target_scale)
            upscaled = cv2.resize(frame, new_size, interpolation=cv2.INTER_CUBIC)
            
            # Apply slight sharpening to simulate AI detail
            gaussian_blur = cv2.GaussianBlur(upscaled, (0, 0), 3)
            sharpened = cv2.addWeighted(upscaled, 1.5, gaussian_blur, -0.5, 0)
            
            cv2.imwrite(out_path, sharpened)
            if i % 10 == 0:
                print(f"Processed fallback frame {i}/{count}...")

    print("Stitching frames back into video...")
    
    first_frame_path = os.path.join(out_frames_dir, "00000000.jpg")
    first_frame = cv2.imread(first_frame_path)
    height, width, layers = first_frame.shape
    
    # Using mp4v codec for standard mp4 output via openCV
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    out = cv2.VideoWriter(output_video, fourcc, fps, (width, height))
    
    for i in range(count):
        frame_path = os.path.join(out_frames_dir, f"{i:08d}.jpg")
        frame = cv2.imread(frame_path)
        out.write(frame)
        
    out.release()
    
    print("Cleaning up temporary files...")
    shutil.rmtree(frames_dir)
    shutil.rmtree(out_frames_dir)
    print("Success: Video saved to", output_video)

if __name__ == "__main__":
    if len(sys.argv) < 4:
        print("Usage: python upscale.py <input_video_path> <output_video_path> <type>")
        sys.exit(1)
        
    input_vid = sys.argv[1]
    output_vid = sys.argv[2]
    filter_type = sys.argv[3]
    
    process_video(input_vid, output_vid, filter_type)
