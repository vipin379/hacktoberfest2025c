from Battle import Battle
from random import randint
import asyncio
from colorama import Fore, Style, init, Back
import os
import traceback

def clear():
    if os.name == 'nt':
        os.system('cls')
    else:
        os.system('clear')

async def main():
    init()  # Initialize colorama

    while True:
        # Create a new Battle instance
        battle = Battle()

        try:
            await battle.connect()
        except Exception as e:
            print(f"Error connecting to battle: {e}")
            continue

        clear()

        # Print battle outcome
        print(f"> {battle.player1['name']} ({battle.player1['energy']}) {Back.WHITE + Fore.BLACK}VERSUS{Style.RESET_ALL} ({battle.player2['energy']}) {battle.player2['name']}")
        print(f"                                        > You {Fore.WHITE}{Back.GREEN if battle.result=='WIN' else Back.RED}{battle.result}{Style.RESET_ALL} {Style.BRIGHT}{battle.reward}{Style.RESET_ALL} coins !")

        # Remove any delay and immediately restart the loop
        clear()

if __name__ == '__main__':
    while True:
        try:
            asyncio.run(main())
        except KeyboardInterrupt:
            print("                                        > Goodbye :)")
            break
        except Exception as err:
            clear()
            traceback.print_exc()
            print("BOT HAS CRASHED :(")
            print("Trying again in 60 seconds ...")
            asyncio.sleep(60)
