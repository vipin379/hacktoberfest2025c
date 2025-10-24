import java.util.Scanner;
import java.util.Random;

public class TebakAngka {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        Random random = new Random();
        
        int angkaRahasia = random.nextInt(100) + 1;
        int tebakan = 0;
        
        while (tebakan != angkaRahasia) {
            System.out.print("Tebak angka antara 1 dan 100: ");
            tebakan = scanner.nextInt();
            if (tebakan < angkaRahasia) {
                System.out.println("Tebakan terlalu rendah!");
            } else if (tebakan > angkaRahasia) {
                System.out.println("Tebakan terlalu tinggi!");
            }
        }
        System.out.println("Selamat! Tebakan kamu benar.");
    }
}
