#!/usr/bin/env python3
"""
Password Strength Checker

Usage:
    python3 password_strength.py "MyP@ssw0rd!"
    python3 password_strength.py --file passwords.txt
"""

from __future__ import annotations
import argparse
import re
import sys
from typing import Dict, List, Tuple

# scoring parameters
MIN_LENGTH = 8

SPECIAL_CHARS_PATTERN = re.compile(r"[!@#$%^&*()_\-+=\[\]{};:'\"\\|,.<>\/?`~]")
UPPER_PATTERN = re.compile(r"[A-Z]")
LOWER_PATTERN = re.compile(r"[a-z]")
DIGIT_PATTERN = re.compile(r"\d")

COMMON_PATTERNS = [
    r"password",
    r"1234",
    r"qwerty",
    r"admin",
    r"letmein",
    r"1111",
    r"0000",
]


def score_password(pw: str) -> Tuple[int, List[str]]:
    """
    Score password from 0 to 100 and return list of suggestions.
    Higher is stronger.
    """
    suggestions: List[str] = []
    score = 0

    length = len(pw)
    # length contribution (up to 30)
    if length >= MIN_LENGTH:
        # more length gets more score
        extra = min(max(length - MIN_LENGTH, 0), 20)
        score += 15 + extra  # base 15 for meeting min length, up to +35 total for length
    else:
        score += int((length / MIN_LENGTH) * 15)
        suggestions.append(f"Increase length to at least {MIN_LENGTH} characters.")

    # character variety contributions
    if UPPER_PATTERN.search(pw):
        score += 15
    else:
        suggestions.append("Add at least one uppercase letter (A-Z).")

    if LOWER_PATTERN.search(pw):
        score += 15
    else:
        suggestions.append("Add at least one lowercase letter (a-z).")

    if DIGIT_PATTERN.search(pw):
        score += 15
    else:
        suggestions.append("Add at least one digit (0-9).")

    if SPECIAL_CHARS_PATTERN.search(pw):
        score += 15
    else:
        suggestions.append("Add at least one special character (e.g. !@#$%).")

    # penalty for common patterns
    lowered = pw.lower()
    for patt in COMMON_PATTERNS:
        if patt in lowered:
            score -= 30
            suggestions.append("Avoid common words or sequences (e.g. 'password', '1234', 'qwerty').")
            break

    # penalty for repeated characters or only one type
    if len(set(pw)) < max(3, length // 3):
        score -= 10
        suggestions.append("Avoid long runs of the same character or using very few unique characters.")

    # clamp
    score = max(0, min(100, score))

    if score >= 90:
        # best case: no suggestions
        suggestions = []

    return score, suggestions


def verdict(score: int) -> str:
    if score >= 90:
        return "Very Strong"
    if score >= 75:
        return "Strong"
    if score >= 50:
        return "Moderate"
    if score >= 25:
        return "Weak"
    return "Very Weak"


def check_and_print(pw: str) -> None:
    sc, suggestions = score_password(pw)
    print(f"Password: {pw}")
    print(f"Score: {sc}/100  — {verdict(sc)}")
    if suggestions:
        print("Suggestions:")
        # unique suggestions in order
        seen = set()
        for s in suggestions:
            if s not in seen:
                print(f" - {s}")
                seen.add(s)
    else:
        print("Great! No suggestions — your password looks strong.")


def main(argv=None):
    parser = argparse.ArgumentParser(description="Password Strength Checker")
    parser.add_argument("passwords", nargs="*", help="password(s) to check (quote if containing special chars)")
    parser.add_argument("--file", "-f", help="file with one password per line")
    args = parser.parse_args(argv)

    inputs: List[str] = []
    if args.file:
        try:
            with open(args.file, "r", encoding="utf-8") as fh:
                for line in fh:
                    pw = line.rstrip("\n\r")
                    if pw:
                        inputs.append(pw)
        except FileNotFoundError:
            print(f"Error: file not found: {args.file}", file=sys.stderr)
            sys.exit(2)

    # positional passwords
    inputs.extend(args.passwords)

    if not inputs:
        parser.print_help()
        return

    for pw in inputs:
        check_and_print(pw)
        print("-" * 40)


if __name__ == "__main__":
    main()
