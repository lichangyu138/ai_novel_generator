import pymysql

conn = pymysql.connect(
    host='10.8.6.45',
    port=13306,
    user='root',
    password='4BTFesFsCtjAWX5D',
    database='ai_novel_generator'
)

cursor = conn.cursor()

sql = """
ALTER TABLE chapterreviews
ADD COLUMN plotSummary text AFTER qualityScore,
ADD COLUMN openingDescription text AFTER plotSummary,
ADD COLUMN middleDescription text AFTER openingDescription,
ADD COLUMN endingDescription text AFTER middleDescription,
ADD COLUMN keyIssues text AFTER endingDescription
"""

try:
    cursor.execute(sql)
    conn.commit()
    print("✅ 字段添加成功！")
except Exception as e:
    print(f"❌ 错误: {e}")
finally:
    cursor.close()
    conn.close()

