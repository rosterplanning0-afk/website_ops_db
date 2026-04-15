import pandas as pd
import os

file_path = r'C:\Users\BangeraP\Documents\my\my\py_pro\IVU_reprot_analyse\Report IVU\Employee details\OCC.xlsx'
output_sql = 'sync_occ_employees.sql'

def get_sql_string(val):
    if pd.isna(val): return 'NULL'
    return "'" + str(val).replace("'", "''") + "'"

try:
    df = pd.read_excel(file_path)
    
    # Standardize columns
    df['employee_id'] = df['employee_id'].astype(str).str.replace('.0', '', regex=False).str.strip()
    df['name'] = df['Employee name'].astype(str).str.strip()
    df['designation'] = df['designation'].astype(str).str.strip()
    df['department'] = 'OCC'
    df['status'] = 'Active' # Default to Active as per request

    sql_statements = []
    
    for _, row in df.iterrows():
        eid = row['employee_id']
        name = row['name'].replace("'", "''")
        desig = row['designation'].replace("'", "''")
        dept = 'OCC'
        gender = str(row['gender']).strip() if not pd.isna(row.get('gender')) else 'NULL'
        gender_val = f"'{gender}'" if gender != 'NULL' else "NULL"
        
        # Manager Logic
        if desig in ['Fault Management Controller (S&T)', 'Traction Power Controller']:
            manager_id = '77140343'
        else:
            manager_id = '77140296'
            
        sql = f"""
INSERT INTO public.employees (employee_id, name, designation, department, status, role, manager_id, gender) 
VALUES ('{eid}', '{name}', '{desig}', '{dept}', 'Active', 'employee', '{manager_id}', {gender_val})
ON CONFLICT (employee_id) DO UPDATE SET
    name = EXCLUDED.name,
    designation = EXCLUDED.designation,
    department = EXCLUDED.department,
    status = EXCLUDED.status,
    manager_id = EXCLUDED.manager_id,
    gender = EXCLUDED.gender;
""".strip()
        sql_statements.append(sql)

    with open(output_sql, 'w', encoding='utf-8') as f:
        f.write('\n'.join(sql_statements))
        
    print(f"Generated {len(sql_statements)} UPSERT statements in {output_sql}")

except Exception as e:
    print(f"Error: {e}")
