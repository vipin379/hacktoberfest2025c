# pip install Pillow in terminal
from PIL import Image
import sys
import os

class ImageToASCII:
    def __init__(self):
        self.ascii_chars = "@%#*+=-:. "
        # self.ascii_chars = "$@B%8&WM#*oahkbdpqwmZO0QLCJUYXzcvunxrjft/\\|()1{}[]?-_+~<>i!lI;:,\"^`'. "

    def get_ascii_char(self, gray_value):
        ascii_index = int((gray_value / 255) * (len(self.ascii_chars) - 1))
        return self.ascii_chars[ascii_index]

    def resize_image(self, image, new_width=100):
        width, height = image.size
        new_height = int((height * new_width * 0.55) / width)
        return image.resize((new_width, new_height))

    def image_to_grayscale(self, image):
        return image.convert("L")

    def pixels_to_ascii(self, image):
        ascii_str = ""
        pixels = image.getdata()

        for pixel in pixels:
            ascii_str += self.get_ascii_char(pixel)

        return ascii_str

    def format_ascii(self, ascii_str, width):
        ascii_lines = []
        for i in range(0, len(ascii_str), width):
            ascii_lines.append(ascii_str[i:i+width])
        return "\n".join(ascii_lines)

    def convert_image_to_ascii(self, image_path, output_width=100, save_to_file=None):
        try:
            image = Image.open(image_path)
            print(f"Berhasil membuka gambar: {image_path}")
            print(f"Ukuran asli: {image.size}")

            image = self.resize_image(image, output_width)
            print(f"Ukuran setelah resize: {image.size}")

            image = self.image_to_grayscale(image)
            ascii_str = self.pixels_to_ascii(image)
            ascii_art = self.format_ascii(ascii_str, output_width)

            print("\n" + "="*50)
            print("ASCII ART RESULT:")
            print("="*50)
            print(ascii_art)
            print("="*50)

            if save_to_file:
                with open(save_to_file, 'w', encoding='utf-8') as f:
                    f.write(ascii_art)
                print(f"\nASCII art berhasil disimpan ke: {save_to_file}")

            return ascii_art

        except FileNotFoundError:
            print(f"Error: File gambar '{image_path}' tidak ditemukan!")
            return None
        except Exception as e:
            print(f"Error saat memproses gambar: {str(e)}")
            return None

def main():

    converter = ImageToASCII()

    if len(sys.argv) < 2:
        print("Penggunaan:")
        print("python jokowi_face.py <path_gambar> [lebar_output] [file_output]")
        print("\nContoh:")
        print("python jokowi_face.py gambar.jpg 80 output.txt")

    image_path = sys.argv[1]
    output_width = int(sys.argv[2]) if len(sys.argv) > 2 else 100
    output_file = sys.argv[3] if len(sys.argv) > 3 else None

    if output_width < 10 or output_width > 200:
        print("Peringatan: Lebar output sebaiknya antara 10-200 karakter")

    result = converter.convert_image_to_ascii(image_path, output_width, output_file)

    if result:
        print(f"\nProses konversi selesai!")
        print(f"Gambar: {image_path}")
        print(f"Lebar output: {output_width} karakter")
        if output_file:
            print(f"Disimpan ke: {output_file}")

if __name__ == "__main__":
    print("="*60)
    print(" PROGRAM KONVERSI GAMBAR KE ASCII ART")
    print(" Hacktoberfest 2025")
    print("="*60)

    try:
        from PIL import Image
        main()
    except ImportError:
        print("Error: Library PIL (Pillow) tidak terinstall!")
        print("Silakan install dengan: pip install Pillow")
