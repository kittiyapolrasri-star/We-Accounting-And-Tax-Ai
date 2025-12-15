# -*- coding: utf-8 -*-
import pandas as pd
import os

# List all files in data folder
data_dir = 'data'
files = os.listdir(data_dir)

for i, f in enumerate(files):
    print(f"\n{'='*60}")
    print(f"📄 FILE {i+1}: {f}")
    print('='*60)
    
    try:
        filepath = os.path.join(data_dir, f)
        
        # Read Excel file
        xl = pd.ExcelFile(filepath)
        print(f"📊 Sheets: {xl.sheet_names}")
        
        # Read first sheet
        df = pd.read_excel(filepath, sheet_name=0)
        print(f"📏 Size: {len(df)} rows x {len(df.columns)} columns")
        print(f"\n📋 Columns:")
        for col in df.columns:
            print(f"   - {col}")
        
        print(f"\n📝 First 5 rows:")
        print(df.head(5).to_string())
        
        print(f"\n📈 Data Types:")
        print(df.dtypes.to_string())
        
    except Exception as e:
        print(f"❌ Error: {e}")

print("\n" + "="*60)
print("✅ Analysis Complete!")
