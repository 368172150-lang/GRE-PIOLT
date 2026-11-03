# 初始练习内容审查记录

来源：本项目原创、AI 辅助编写，未复制商业题库。范围为 28 道示例，作者检查题意、答案、选项理由、双语说明与公式；自动测试检查 schema、完整答案键、严格 KaTeX 渲染和 SQL/TypeScript 一致性。没有独立专家/ETS 认证。reviewed 表示本项目作者检查，不表示官方审核。

数值题另以算术关系验证：折扣与税为 66、抽球概率 1/10、比例人数 20、方程根 5、二次方程根 2 和 3、函数值 5、圆周长 6π、矩形面积 54、勾股斜边 10/周长 24、平均数 7、加权平均 76、中位数 9.5、工作时间 30。数量比较分别为信息不足、相等和 B 更大。Verbal 检查句间逻辑、等价选项成对成立及阅读答案由原创文章支持。

| 题号 | 类型 | 答案 |
|---|---|---|
| 1 | text_completion | {"blanks":["A"]} |
| 2 | text_completion | {"blanks":["B"]} |
| 3 | text_completion | {"blanks":["A","E"]} |
| 4 | text_completion | {"blanks":["B","E","G"]} |
| 5 | sentence_equivalence | {"choices":["A","D"]} |
| 6 | sentence_equivalence | {"choices":["B","E"]} |
| 7 | sentence_equivalence | {"choices":["A","F"]} |
| 8 | sentence_equivalence | {"choices":["C","E"]} |
| 9 | reading_comprehension | {"choices":["B"]} |
| 10 | reading_comprehension | {"choices":["C"]} |
| 11 | reading_comprehension | {"choices":["A"]} |
| 12 | reading_comprehension | {"choices":["A","C"]} |
| 13 | single_choice | {"choices":["C"]} |
| 14 | numeric_entry | {"numeric":"1/10"} |
| 15 | single_choice | {"choices":["D"]} |
| 16 | numeric_entry | {"numeric":"5"} |
| 17 | multiple_choice | {"choices":["B","C"]} |
| 18 | single_choice | {"choices":["D"]} |
| 19 | single_choice | {"choices":["B"]} |
| 20 | numeric_entry | {"numeric":"54"} |
| 21 | multiple_choice | {"choices":["A","C"]} |
| 22 | numeric_entry | {"numeric":"7"} |
| 23 | single_choice | {"choices":["C"]} |
| 24 | single_choice | {"choices":["C"]} |
| 25 | quantitative_comparison | {"choices":["D"]} |
| 26 | quantitative_comparison | {"choices":["C"]} |
| 27 | numeric_entry | {"numeric":"30"} |
| 28 | quantitative_comparison | {"choices":["B"]} |

导入入口只暂存草稿。维护者应复核来源、歧义、难度、解释与语言，再提升 review_status；发布前执行完整内容测试和种子生成。运行时无外部 AI 调用、无密钥、无自动发布。



## Phase 5 writing prompts

Four original AI-assisted Issue prompts cover local investment, learning from unsuccessful projects, technology and choice, and immediate research benefits. Author checks confirmed that each is an open, arguable claim with explicit response instructions; no prescribed answer or official score is asserted. They have not received independent GRE-expert/ETS review. Sources and draft/reviewed status are in src/data/writing.json, with TS/SQL seed text parity tested.
