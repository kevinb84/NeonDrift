
import json

def debug_braces(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            lines = f.readlines()
    except Exception as e:
        with open('brace_debug.json', 'w') as f:
            json.dump({"error": str(e)}, f)
        return

    stack = []
    events = []
    
    for i, line in enumerate(lines):
        line_num = i + 1
        for char in line:
            if char == '{':
                stack.append(line_num)
            elif char == '}':
                if not stack:
                    events.append(f"FATAL: Stack empty at line {line_num}")
                    with open('brace_debug.json', 'w') as f:
                        json.dump(events, f)
                    return
                stack.pop()
                if not stack:
                    events.append(f"Stack returned to 0 at line {line_num}: {line.strip()}")
    
    if stack:
        events.append(f"Final stack size: {len(stack)}")
    else:
        events.append("Final stack empty (Balanced).")
    
    with open('brace_debug.json', 'w') as f:
        json.dump(events, f)

debug_braces(r"c:\Users\Aji4r\OneDrive\Desktop\NeonProject\src\game\GameEngine.ts")
