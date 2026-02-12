# AI 编程规范与飞行法则 (AI_RULES)

**当前项目：** ICAO Level 5 ATC Examiner
**机长指令：** 所有代码生成与修改必须严格遵守以下规则。

## 1. 数据库隔离区 (Database & Schema) - 🔴 绝对红线
- **Schema 锁定：** `icao5_trainer`
- **严禁越界：** 严禁读取或写入 `public` 或 `app_student_briefing`。
- **表名规范：** SQL 语句必须带前缀，例如 `SELECT * FROM icao5_trainer.training_logs`。

## 2. 客户端初始化 (Client Init)
- **必须配置 Schema：**
  ```javascript
  const supabase = createClient(url, key, {
    db: { schema: 'icao5_trainer' }
  })