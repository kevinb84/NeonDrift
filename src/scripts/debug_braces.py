
def debug_braces(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    stack = []
    
    for i, line in enumerate(lines):
        line_num = i + 1
        for char in line:
            if char == '{':
                stack.append(line_num)
            elif char == '}':
                if not stack:
                    print(f"FATAL: Stack empty at line {line_num} but found '}}'. Aborting.")
                    return
                stack.pop()
                if not stack:
                    print(f"Stack returned to 0 at line {line_num}: {line.strip()}")
    
    if stack:
        print(f"Final stack size: {len(stack)}")
    else:
        print("Final stack empty (Balanced).")

debug_braces(r"c:\Users\Aji4r\OneDrive\Desktop\NeonProject\src\game\GameEngine.ts")
