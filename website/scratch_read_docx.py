import zipfile
import xml.etree.ElementTree as ET
import os

def docx_to_text(docx_path):
    # docx files are zip archives containing XML files
    # The main document content is in word/document.xml
    try:
        with zipfile.ZipFile(docx_path) as z:
            xml_content = z.read('word/document.xml')
            root = ET.fromstring(xml_content)
            
            # w namespace is standard for Word XML
            namespaces = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
            
            text_runs = []
            for paragraph in root.iter('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}p'):
                para_text = []
                for run in paragraph.iter('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}t'):
                    if run.text:
                        para_text.append(run.text)
                if para_text:
                    text_runs.append(''.join(para_text))
            
            return '\n'.join(text_runs)
    except Exception as e:
        return f"Error reading docx: {str(e)}"

if __name__ == "__main__":
    report_path = "/Users/ankur/Downloads/GasPipeline_PMS_ProjectReport_v2.docx"
    text = docx_to_text(report_path)
    
    with open("project_report.txt", "w", encoding="utf-8") as f:
        f.write(text)
    
    print("Done! Extracted text length:", len(text))