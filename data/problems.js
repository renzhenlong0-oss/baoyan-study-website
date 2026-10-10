/* ============================================================
 * data/problems.js —— 内置题库（精简版：C 10 题 + Python 6 题）
 * 题目结构（需求§21）：
 *   id / language / topic / difficulty / title / description /
 *   input / output / examples / tags / source
 * 训练辅助（提示梯子，需求§23 —— 答题错误时逐层解锁）：
 *   hint（提示）→ thought（思路）→ partialCode（局部代码）→ solution（完整答案）
 * 扩充方式：直接在本文件按同样结构追加题目。
 * ============================================================ */

const PROBLEMS = [
  /* ================= C 语言 ================= */
  {
    id: 'c-io-01',
    language: 'C',
    topic: 'c-basics',
    difficulty: '★',
    title: 'A+B 问题',
    description: '输入两个整数 a 和 b，输出它们的和。',
    input: '一行两个整数 a、b（-10000 ≤ a, b ≤ 10000），以空格分隔。',
    output: '一个整数，即 a+b 的值。',
    examples: [
      { input: '1 2', output: '3' },
      { input: '-5 8', output: '3' }
    ],
    tags: ['输入输出', '变量'],
    source: '内置',
    hint: 'scanf 的 %d 可以连续读取多个整数，格式串中间放空格即可。',
    thought: '1) 声明两个 int 变量；2) scanf("%d %d", &a, &b) 读入；3) printf("%d", a+b) 输出。',
    partialCode: 'int a, b;\nscanf("%d %d", &a, &b);\n// 这里补一行输出 a+b',
    solution: '#include <stdio.h>\nint main() {\n    int a, b;\n    scanf("%d %d", &a, &b);\n    printf("%d\\n", a + b);\n    return 0;\n}'
  },
  {
    id: 'c-io-02',
    language: 'C',
    topic: 'c-basics',
    difficulty: '★',
    title: '圆的面积',
    description: '给定圆的半径 r（整数），计算并输出圆的面积（保留 2 位小数）。圆周率取 3.14159。',
    input: '一个整数 r（1 ≤ r ≤ 100）。',
    output: '一个浮点数，保留 2 位小数。',
    examples: [
      { input: '3', output: '28.27' }
    ],
    tags: ['输入输出', '浮点数'],
    source: '内置',
    hint: '面积 = π × r × r，输出用 printf("%.2f", ...)。',
    thought: '1) 用 double 类型存结果（整数相乘再乘 π 可能溢出 int）；2) %.2f 保留两位小数。',
    partialCode: 'int r;\nscanf("%d", &r);\ndouble area = 3.14159 * r * r;\n// 补一行：保留两位小数输出 area',
    solution: '#include <stdio.h>\nint main() {\n    int r;\n    scanf("%d", &r);\n    double area = 3.14159 * r * r;\n    printf("%.2f\\n", area);\n    return 0;\n}'
  },
  {
    id: 'c-if-01',
    language: 'C',
    topic: 'c-if',
    difficulty: '★',
    title: '闰年判断',
    description: '输入一个年份，判断是否为闰年。闰年规则：能被 4 整除且不能被 100 整除，或能被 400 整除。是输出 YES，否则输出 NO。',
    input: '一个整数 year（1 ≤ year ≤ 10000）。',
    output: 'YES 或 NO。',
    examples: [
      { input: '2024', output: 'YES' },
      { input: '1900', output: 'NO' },
      { input: '2000', output: 'YES' }
    ],
    tags: ['条件', '逻辑运算'],
    source: '内置',
    hint: '两个条件之间是"或"的关系：先算"能被4整除且不能被100整除"，再或上"能被400整除"。',
    thought: '1) 用 % 判断整除；2) 注意运算优先级：&& 高于 ||，必要时加括号。',
    partialCode: 'int year;\nscanf("%d", &year);\nif (/* 补全闰年条件 */) {\n    printf("YES\\n");\n} else {\n    printf("NO\\n");\n}',
    solution: '#include <stdio.h>\nint main() {\n    int year;\n    scanf("%d", &year);\n    if ((year % 4 == 0 && year % 100 != 0) || year % 400 == 0) {\n        printf("YES\\n");\n    } else {\n        printf("NO\\n");\n    }\n    return 0;\n}'
  },
  {
    id: 'c-loop-01',
    language: 'C',
    topic: 'c-loop',
    difficulty: '★',
    title: '1 到 n 求和',
    description: '输入一个正整数 n，计算 1 + 2 + ... + n 的和。',
    input: '一个整数 n（1 ≤ n ≤ 10000）。',
    output: '一个整数，表示求和结果。',
    examples: [
      { input: '5', output: '15' },
      { input: '100', output: '5050' }
    ],
    tags: ['循环', 'for'],
    source: '内置',
    hint: 'for 循环从 1 走到 n（含 n），累加变量初始化为 0。',
    thought: '1) sum = 0；2) for (i=1; i<=n; i++) sum += i；3) 注意循环条件是 <=n，不是 <n。',
    partialCode: 'int n, i, sum = 0;\nscanf("%d", &n);\nfor (i = 1; i <= n; i++) {\n    // 补一行：累加\n}\nprintf("%d\\n", sum);',
    solution: '#include <stdio.h>\nint main() {\n    int n, i, sum = 0;\n    scanf("%d", &n);\n    for (i = 1; i <= n; i++) {\n        sum += i;\n    }\n    printf("%d\\n", sum);\n    return 0;\n}'
  },
  {
    id: 'c-loop-02',
    language: 'C',
    topic: 'c-loop',
    difficulty: '★★',
    title: '打印三角形',
    description: '输入正整数 n，打印一个 n 行的直角三角形：第 i 行输出 i 个 *。',
    input: '一个整数 n（1 ≤ n ≤ 20）。',
    output: '共 n 行，第 i 行 i 个 *（行尾换行）。',
    examples: [
      { input: '3', output: '*\n**\n***' }
    ],
    tags: ['循环', '嵌套循环'],
    source: '内置',
    hint: '外层循环控制行数，内层循环控制每行 * 的个数，内层循环次数 = 当前行号。',
    thought: '1) 外层 for(i=1; i<=n; i++)；2) 内层 for(j=1; j<=i; j++) 输出 *；3) 每行结束 printf("\\n")。',
    partialCode: 'int n, i, j;\nscanf("%d", &n);\nfor (i = 1; i <= n; i++) {\n    for (/* 补全内层循环条件 */) {\n        printf("*");\n    }\n    printf("\\n");\n}',
    solution: '#include <stdio.h>\nint main() {\n    int n, i, j;\n    scanf("%d", &n);\n    for (i = 1; i <= n; i++) {\n        for (j = 1; j <= i; j++) {\n            printf("*");\n        }\n        printf("\\n");\n    }\n    return 0;\n}'
  },
  {
    id: 'c-loop-03',
    language: 'C',
    topic: 'c-loop',
    difficulty: '★★',
    title: 'n 个数中的最大值',
    description: '输入 n 和 n 个整数，输出其中的最大值。',
    input: '第一行一个整数 n（1 ≤ n ≤ 1000），第二行 n 个整数，以空格分隔。',
    output: '一个整数，即 n 个数中的最大值。',
    examples: [
      { input: '5\n3 -1 8 2 0', output: '8' },
      { input: '1\n42', output: '42' }
    ],
    tags: ['循环', '循环边界', '数组基础'],
    source: '内置',
    hint: '最大值变量初始化为第一个数，再从第二个数开始比较。循环边界：只比较 n-1 次。',
    thought: '1) 先读第一个数作为 max；2) 循环 i=2..n 读剩余的数并与 max 比较；3) 注意边界：n=1 时循环不执行，直接输出 max。',
    partialCode: 'int n, i, x, max;\nscanf("%d", &n);\nscanf("%d", &max);\nfor (i = 2; i <= n; i++) {\n    scanf("%d", &x);\n    // 补一行：更新 max\n}\nprintf("%d\\n", max);',
    solution: '#include <stdio.h>\nint main() {\n    int n, i, x, max;\n    scanf("%d", &n);\n    scanf("%d", &max);\n    for (i = 2; i <= n; i++) {\n        scanf("%d", &x);\n        if (x > max) max = x;\n    }\n    printf("%d\\n", max);\n    return 0;\n}'
  },
  {
    id: 'c-array-01',
    language: 'C',
    topic: 'c-array',
    difficulty: '★★',
    title: '数组逆序输出',
    description: '输入 n 个整数存入数组，按输入相反的顺序输出。',
    input: '第一行一个整数 n（1 ≤ n ≤ 100），第二行 n 个整数。',
    output: '一行，n 个整数按逆序输出，以空格分隔。',
    examples: [
      { input: '5\n1 2 3 4 5', output: '5 4 3 2 1' }
    ],
    tags: ['数组', '循环'],
    source: '内置',
    hint: '下标从 0 开始：最后读入的元素是 a[n-1]，逆序输出即 i 从 n-1 递减到 0。',
    thought: '1) 声明 int a[100]；2) for(i=0;i<n;i++) 读入；3) for(i=n-1;i>=0;i--) 输出。',
    partialCode: 'int n, i, a[100];\nscanf("%d", &n);\nfor (i = 0; i < n; i++) {\n    scanf("%d", &a[i]);\n}\nfor (/* 补全逆序循环 */) {\n    printf("%d ", a[i]);\n}',
    solution: '#include <stdio.h>\nint main() {\n    int n, i, a[100];\n    scanf("%d", &n);\n    for (i = 0; i < n; i++) {\n        scanf("%d", &a[i]);\n    }\n    for (i = n - 1; i >= 0; i--) {\n        printf("%d ", a[i]);\n    }\n    printf("\\n");\n    return 0;\n}'
  },
  {
    id: 'c-array-02',
    language: 'C',
    topic: 'c-array',
    difficulty: '★★',
    title: '数组求和与平均',
    description: '输入 n 个整数，输出它们的和与平均值（保留 1 位小数）。',
    input: '第一行一个整数 n（1 ≤ n ≤ 100），第二行 n 个整数。',
    output: '一行：和 与 平均值（保留 1 位小数），以空格分隔。',
    examples: [
      { input: '4\n1 2 3 4', output: '10 2.5' }
    ],
    tags: ['数组', '类型转换'],
    source: '内置',
    hint: '平均值要用浮点除法：sum 是 int，除以 n 前先转 double，即 (double)sum / n。',
    thought: '1) 循环累加 sum；2) avg = (double)sum / n（不转类型会整数除法丢小数）；3) %.1f 输出。',
    partialCode: 'int n, i, a[100], sum = 0;\nscanf("%d", &n);\nfor (i = 0; i < n; i++) {\n    scanf("%d", &a[i]);\n    // 补一行：累加\n}\nprintf("%d %.1f\\n", sum, /* 补全平均值的浮点除法 */);',
    solution: '#include <stdio.h>\nint main() {\n    int n, i, a[100], sum = 0;\n    scanf("%d", &n);\n    for (i = 0; i < n; i++) {\n        scanf("%d", &a[i]);\n        sum += a[i];\n    }\n    printf("%d %.1f\\n", sum, (double)sum / n);\n    return 0;\n}'
  },
  {
    id: 'c-func-01',
    language: 'C',
    topic: 'c-func',
    difficulty: '★★',
    title: '函数求最大值',
    description: '编写函数 int mymax(int a, int b) 返回两数中的较大值。主函数读入两个整数，调用 mymax 输出结果。',
    input: '一行两个整数，以空格分隔。',
    output: '一个整数，两数中的较大值。',
    examples: [
      { input: '3 9', output: '9' }
    ],
    tags: ['函数'],
    source: '内置',
    hint: '函数定义要放在 main 之前（或先声明原型）。用 if 或三元运算符返回较大值。',
    thought: '1) 定义 int mymax(int a, int b)；2) 函数内比较返回大者；3) main 里 printf("%d", mymax(x, y))。',
    partialCode: 'int mymax(int a, int b) {\n    // 补一行：返回较大值\n}\nint main() {\n    int x, y;\n    scanf("%d %d", &x, &y);\n    printf("%d\\n", mymax(x, y));\n    return 0;\n}',
    solution: '#include <stdio.h>\nint mymax(int a, int b) {\n    return a > b ? a : b;\n}\nint main() {\n    int x, y;\n    scanf("%d %d", &x, &y);\n    printf("%d\\n", mymax(x, y));\n    return 0;\n}'
  },
  {
    id: 'c-func-02',
    language: 'C',
    topic: 'c-func',
    difficulty: '★★★',
    title: '阶乘函数',
    description: '编写函数 long long fact(int n) 计算 n 的阶乘（n! = 1×2×...×n）。主函数读入 n（0 ≤ n ≤ 20），输出 n!。',
    input: '一个整数 n（0 ≤ n ≤ 20）。',
    output: '一个整数，n! 的值。',
    examples: [
      { input: '5', output: '120' },
      { input: '0', output: '1' }
    ],
    tags: ['函数', '循环', '边界'],
    source: '内置',
    hint: '0! = 1 是边界条件。阶乘增长很快，n=20 时已超 int 范围，返回值要用 long long。',
    thought: '1) 处理边界：n==0 返回 1；2) 循环 1..n 累乘，用 long long 变量；3) 输出用 %lld。',
    partialCode: 'long long fact(int n) {\n    // 补全：处理 n==0 的边界 + 循环累乘\n}\nint main() {\n    int n;\n    scanf("%d", &n);\n    printf("%lld\\n", fact(n));\n    return 0;\n}',
    solution: '#include <stdio.h>\nlong long fact(int n) {\n    long long r = 1;\n    int i;\n    for (i = 1; i <= n; i++) {\n        r *= i;\n    }\n    return r;\n}\nint main() {\n    int n;\n    scanf("%d", &n);\n    printf("%lld\\n", fact(n));\n    return 0;\n}'
  },

  /* ================= Python ================= */
  {
    id: 'py-basics-01',
    language: 'Python',
    topic: 'py-basics',
    difficulty: '★',
    title: '你好，Python',
    description: '输入你的名字（不含空格），输出一行："你好，{名字}！"',
    input: '一行字符串，不含空格。',
    output: '一行：你好，{名字}！',
    examples: [
      { input: '小明', output: '你好，小明！' }
    ],
    tags: ['输入输出', '字符串'],
    source: '内置',
    hint: 'input() 读取一行字符串，print 可以直接拼接输出，或用 f-string：print(f"你好，{name}！")。',
    thought: '1) name = input()；2) print 拼接输出即可。',
    partialCode: 'name = input()\n# 补一行：按要求格式输出',
    solution: 'name = input()\nprint(f"你好，{name}！")'
  },
  {
    id: 'py-if-01',
    language: 'Python',
    topic: 'py-if',
    difficulty: '★',
    title: '成绩等级',
    description: '输入一个 0-100 的整数分数，输出等级：90 及以上 A，80-89 为 B，70-79 为 C，60-69 为 D，60 以下为 E。',
    input: '一个整数 score（0 ≤ score ≤ 100）。',
    output: '一个字母：A / B / C / D / E。',
    examples: [
      { input: '95', output: 'A' },
      { input: '59', output: 'E' }
    ],
    tags: ['条件', 'if/elif'],
    source: '内置',
    hint: '用 if / elif / else 链，注意 elif 的判断顺序从高到低。',
    thought: '1) score = int(input())（input 返回字符串，要转 int）；2) 按 90/80/70/60 边界写 elif。',
    partialCode: 'score = int(input())\nif score >= 90:\n    print("A")\nelif # 补全其余分支',
    solution: 'score = int(input())\nif score >= 90:\n    print("A")\nelif score >= 80:\n    print("B")\nelif score >= 70:\n    print("C")\nelif score >= 60:\n    print("D")\nelse:\n    print("E")'
  },
  {
    id: 'py-loop-01',
    language: 'Python',
    topic: 'py-loop',
    difficulty: '★',
    title: '1 到 n 求和',
    description: '输入正整数 n，输出 1 到 n 的和。',
    input: '一个整数 n（1 ≤ n ≤ 10000）。',
    output: '一个整数。',
    examples: [
      { input: '100', output: '5050' }
    ],
    tags: ['循环', 'range'],
    source: '内置',
    hint: 'range(1, n+1) 生成 1..n（注意右端点不包含，所以要 n+1）。',
    thought: '1) 用 sum(range(1, n+1)) 一步完成，或 for 循环累加。',
    partialCode: 'n = int(input())\n# 补一行：输出 1 到 n 的和',
    solution: 'n = int(input())\nprint(sum(range(1, n + 1)))'
  },
  {
    id: 'py-loop-02',
    language: 'Python',
    topic: 'py-loop',
    difficulty: '★★',
    title: '判断素数',
    description: '输入正整数 n（n ≥ 2），判断是否为素数。是输出 YES，否则输出 NO。',
    input: '一个整数 n（2 ≤ n ≤ 1000000）。',
    output: 'YES 或 NO。',
    examples: [
      { input: '7', output: 'YES' },
      { input: '12', output: 'NO' }
    ],
    tags: ['循环', 'break', '算法'],
    source: '内置',
    hint: '只需试除到 sqrt(n)：如果找到因子立即 break，循环结束后用 for-else 或标志位判断。',
    thought: '1) 特判 n==2；2) 循环 i 从 2 到 int(n**0.5)；3) n % i == 0 则非素数，break。',
    partialCode: 'n = int(input())\n# 补全：试除判断素数（注意用 for-else 或标志位）',
    solution: 'n = int(input())\nif n < 2:\n    print("NO")\nelse:\n    for i in range(2, int(n ** 0.5) + 1):\n        if n % i == 0:\n            print("NO")\n            break\n    else:\n        print("YES")'
  },
  {
    id: 'py-func-01',
    language: 'Python',
    topic: 'py-func',
    difficulty: '★★',
    title: '函数求阶乘',
    description: '定义函数 fact(n) 返回 n 的阶乘（n ≥ 0）。读入 n（0 ≤ n ≤ 20），输出 n!。',
    input: '一个整数 n（0 ≤ n ≤ 20）。',
    output: '一个整数。',
    examples: [
      { input: '5', output: '120' },
      { input: '0', output: '1' }
    ],
    tags: ['函数', '循环'],
    source: '内置',
    hint: '函数内初始化 result = 1，循环 1..n 累乘。0! 自然等于 1，无需特判。',
    thought: '1) def fact(n): 内部循环累乘；2) 主程序调用 fact(n) 并 print。',
    partialCode: 'def fact(n):\n    # 补全函数体\n\nn = int(input())\nprint(fact(n))',
    solution: 'def fact(n):\n    result = 1\n    for i in range(1, n + 1):\n        result *= i\n    return result\n\nn = int(input())\nprint(fact(n))'
  },
  {
    id: 'py-list-01',
    language: 'Python',
    topic: 'py-list',
    difficulty: '★★',
    title: '列表最大值',
    description: '第一行输入 n，第二行输入 n 个整数（空格分隔），输出其中的最大值。',
    input: '第一行一个整数 n（1 ≤ n ≤ 1000），第二行 n 个整数。',
    output: '一个整数。',
    examples: [
      { input: '5\n3 -1 8 2 0', output: '8' }
    ],
    tags: ['List', '循环'],
    source: '内置',
    hint: '第二行用 input().split() 切分成字符串列表，再用 map(int, ...) 转整数。',
    thought: '1) nums = list(map(int, input().split()))；2) print(max(nums)) 或手写循环。',
    partialCode: 'n = int(input())\n# 补一行：读入一行整数列表\n# 补一行：输出最大值',
    solution: 'n = int(input())\nnums = list(map(int, input().split()))\nprint(max(nums))'
  }
];
