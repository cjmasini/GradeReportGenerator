import base64
import os
import re
import sys 

def create_logo_image(settings, logo_directory: str = None) -> str:
    if not hasattr(settings, 'school_logo_dataurl') or not settings.school_logo_dataurl:
        print("Error: 'school_logo_dataurl' not found in settings or is empty. Please ensure it's set correctly.")
        return ""

    data_url = settings.school_logo_dataurl

    match = re.match(r"data:image/(\w+);base64,(.*)", data_url)
    if not match:
        print("Error: Invalid data URL format. Expected 'data:image/<extension>;base64,...'")
        return ""

    file_extension = match.group(1).lower() 
    if file_extension == 'jpeg':
        file_extension = 'jpg'
    
    base64_string = match.group(2)

    try:
        image_data = base64.b64decode(base64_string)
        if not image_data:
            print("Error: Decoded image data is empty. The base64 string might be invalid.")
            return ""
    except base64.binascii.Error as e:
        print(f"Error decoding base64 string: {e}. Ensure the base64 string is valid.")
        return ""
    except Exception as e:
        print(f"An unexpected error occurred during base64 decoding: {e}")
        return ""

    if logo_directory:
        output_base_dir = os.path.join(logo_directory, 'user_logos')
    else:

        if hasattr(sys, '_MEIPASS'):
            script_dir = os.path.dirname(sys.executable)
        else:
            script_dir = os.path.dirname(os.path.abspath(__file__))
        
        output_base_dir = os.path.join(script_dir, '..', 'user_assets')
        print(f"Warning: userDataPath not provided. Saving logo to local development path: {output_base_dir}")

    try:
        os.makedirs(output_base_dir, exist_ok=True)
        print(f"Ensured output directory exists: {output_base_dir}")
    except Exception as e:
        print(f"Error creating output directory {output_base_dir}: {e}. Check permissions.")
        return ""

    fixed_filename = f"logo.{file_extension}"
    file_path = os.path.join(output_base_dir, fixed_filename)

    try:
        with open(file_path, 'wb') as f:
            f.write(image_data)
        return file_path
    except IOError as e:
        print(f"Error writing image file to {file_path}: {e}. Check directory permissions.")
        return ""
    except Exception as e:
        print(f"An unexpected error occurred during file writing: {e}")
        return ""