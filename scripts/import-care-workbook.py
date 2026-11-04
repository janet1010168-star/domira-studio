"""Read a user-authorized xlsx into the reference catalog; never modifies input.
Usage: python scripts/import-care-workbook.py INPUT.xlsx
"""
import sys,json,hashlib
from pathlib import Path
import openpyxl
p=Path(sys.argv[1]);w=openpyxl.load_workbook(p,read_only=True,data_only=False);sheets=[]
for index,s in enumerate(w.worksheets,1):
 rows=list(s.iter_rows(values_only=True));headers=[str(v) for v in rows[2]];records=[]
 for n,row in enumerate(rows[3:],4):
  if not any(v is not None for v in row):continue
  records.append(dict(id=f'{["STD","AID","DES","CHN"][index-1]}-{n:03}',source_sheet=s.title,source_row=n,fields={k:row[i] if i<len(row) else None for i,k in enumerate(headers)}))
 sheets.append(dict(name=s.title,title=rows[0][0],description=rows[1][0],headers=headers,records=records))
w.close();data=dict(version='2026-11-04',source=dict(filename=p.name,sha256=hashlib.sha256(p.read_bytes()).hexdigest()),sheets=sheets,total=sum(len(s['records']) for s in sheets),note='使用者提供的品類參考資料，價格與規範文字未逐項網上核驗；不是完整SKU尺寸或法定認證。')
out=Path(__file__).resolve().parents[1]/'public'/'care-data.js';out.write_text('export const CARE_DATA='+json.dumps(data,ensure_ascii=False,separators=(',',':'))+';\n',encoding='utf-8')
print(json.dumps({'records':data['total'],'sheets':[len(s['records']) for s in sheets]},ensure_ascii=False))
