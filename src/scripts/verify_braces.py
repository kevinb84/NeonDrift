
import re
import itertools

def verify_braces(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    stack: list[tuple[str, int]] = []
    
    for i, line in enumerate(lines):
        line_num = i + 1
        for char in line:
            if char == '{':
                stack.append(('{', line_num))
            elif char == '}':
                if not stack:
                    print(f"Error: Unexpected closing brace at line {line_num}")
                    return
                stack.pop()
    
    if stack:
        print(f"Error: Unclosed brace at line {stack[-1][1]}")
        print(f"Stack size: {len(stack)}")
        # Print last few unclosed braces
        start = max(0, len(stack) - 5)
        for item in itertools.islice(stack, start, len(stack)):
            print(f"Pending: {item}")
    else:
        print("All braces balanced.")

verify_braces(r"c:\Users\Aji4r\OneDrive\Desktop\NeonProject\src\game\GameEngine.ts")
