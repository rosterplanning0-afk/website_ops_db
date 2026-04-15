import pandas as pd
import json
import re
import os

file_path = r'C:\Users\BangeraP\Documents\my\my\py_pro\IVU_reprot_analyse\online_version\Employee details\to_ta_emp_details.xlsx'
db_output_path = r'C:\Users\BangeraP\.gemini\antigravity\brain\94ef8d61-c22d-4798-b361-2a328649f7f0\.system_generated\steps\1412\output.txt'

# Parse DB Json
with open(db_output_path, 'r', encoding='utf-8') as f:
    raw_json = json.load(f)

result_text = raw_json['result']

# Find the json array
match = re.search(r'\[\{.*?\}\]', result_text, re.DOTALL)
if match:
    parsed_rows = json.loads(match.group(0))
    db_emps = []
    for row in parsed_rows:
        parts = row['row_data'].split('|')
        db_emps.append({
            'employee_id': parts[0],
            'name': parts[1] if len(parts) > 1 else '',
            'designation': parts[2] if len(parts) > 2 else '',
            'department': parts[3] if len(parts) > 3 else '',
            'status': parts[4] if len(parts) > 4 else ''
        })
else:
    print("Could not find JSON array in DB output.")
    db_emps = []

print(f'Total employees in DB: {len(db_emps)}')

# Read excel
xls = pd.ExcelFile(file_path)
df_to = pd.read_excel(xls, sheet_name='TO')
df_ta = pd.read_excel(xls, sheet_name='TA')

# Rename columns to standard
df_to = df_to.rename(columns={'Employee Name': 'name'})
df_ta = df_ta.rename(columns={'Employee name': 'name'})

excel_emps = pd.concat([df_to, df_ta], ignore_index=True)
excel_emps['employee_id'] = excel_emps['employee_id'].astype(str)
excel_emps['employee_id'] = excel_emps['employee_id'].apply(lambda x: x.replace('.0', '') if x.endswith('.0') else x)

excel_emp_dict = {}
for _, row in excel_emps.iterrows():
    if pd.isna(row['employee_id']) or str(row['employee_id']).lower() == 'nan': continue
    excel_emp_dict[str(row['employee_id']).strip()] = row

print(f'Total employees in Excel: {len(excel_emp_dict)}')

sql_statements = []

db_emp_ids = set()
for d in db_emps:
    eid = str(d['employee_id']).strip()
    db_emp_ids.add(eid)
    dept = str(d.get('department', ''))
    desig = str(d.get('designation', ''))
    status = str(d.get('status', 'Active'))
    
    if desig == 'Crew Controller':
        continue
        
    if dept == 'Train Operations' or desig in ['Train Operator', 'Train Attendant']:
        if eid not in excel_emp_dict:
            if status != 'Inactive':
                sql_statements.append(f"UPDATE public.employees SET status='Inactive' WHERE employee_id='{eid}';")
        else:
            if status != 'Active':
                sql_statements.append(f"UPDATE public.employees SET status='Active' WHERE employee_id='{eid}';")

for eid, row in excel_emp_dict.items():
    if eid not in db_emp_ids:
        name = str(row.get('name', '')).replace("'", "''")
        desig = str(row.get('designation', 'Train Operator')).replace("'", "''")
        dept = str(row.get('department', 'Train Operations'))
        if dept == 'nan': dept = 'Train Operations'
        dept = dept.replace("'", "''")
        
        sql_statements.append(f"INSERT INTO public.employees (employee_id, name, designation, department, status, role) VALUES ('{eid}', '{name}', '{desig}', '{dept}', 'Active', 'employee');")

with open('sync_employees.sql', 'w') as f:
    f.write('\n'.join(sql_statements))

print(f'Generated {len(sql_statements)} SQL statements. Saved to sync_employees.sql')
