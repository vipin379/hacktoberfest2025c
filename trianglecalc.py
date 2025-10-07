print("=== Triangle Calculator ===")

base = float(input("Enter the base: "))
height = float(input("Enter the height: "))
side1 = float(input("Enter side 1: "))
side2 = float(input("Enter side 2: "))
side3 = float(input("Enter side 3: "))

area = 0.5 * base * height
perimeter = side1 + side2 + side3

print(f"\nArea of Triangle: {area:.2f}")
print(f"Perimeter of Triangle: {perimeter:.2f}")
