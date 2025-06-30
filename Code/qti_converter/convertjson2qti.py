import json
import uuid
import zipfile
from pathlib import Path
from jinja2 import Environment, PackageLoader, select_autoescape,FileSystemLoader
import tempfile

class QtiConverter:
    def __init__(self, template_dir="Code/qti_converter/templates"):
        self.env = Environment(
            loader=FileSystemLoader(template_dir),
            autoescape=True,
            trim_blocks=True,
            lstrip_blocks=True
        )
        self.templates = {
            'multiple_choice': self.env.get_template('multiple_choice.xml.j2'),
            'true_false': self.env.get_template('true_false.xml.j2'),
            'multiple_answers': self.env.get_template('multiple_answers.xml.j2'),
            'essay': self.env.get_template('essay.xml.j2'),
            'fill_in_blank': self.env.get_template('fill_in_blank.xml.j2'),
            'matching': self.env.get_template('matching.xml.j2')
        }

    def convert_json_to_qti(self, json_file, output_zip):
        """Main conversion method"""
        with open(json_file) as f:
            data = json.load(f)

        with tempfile.TemporaryDirectory() as temp_dir:
            temp_path = Path(temp_dir)
            self._create_manifest(data, temp_path)
            self._create_resources(data, temp_path)
            self._create_zip(temp_path, output_zip)

    def _create_resources(self, data, temp_path):
        """Generate question XML files"""
        resource_dir = temp_path / 'resources'
        resource_dir.mkdir()

        for question in data['questions']:
            q_type = question['question_type']
            template = self.templates[q_type]
            
            # Add unique identifiers required by QTI
            question['identifier'] = f"ib8a9a7e3f47_{question['question_id']}"
            question['response_id'] = f"response_{question['question_id']}"
            question['outcome_id'] = f"outcome_{question['question_id']}"

            xml_content = template.render(
                question=question,
                points=question['points_possible']
            )
            
            with open(resource_dir / f"{question['question_id']}.xml", 'w') as f:
                f.write(xml_content)

    def _create_manifest(self, data, temp_path):
        """Create imsmanifest.xml file"""
        manifest_template = self.env.get_template('imsmanifest.xml.j2')
        resources = [
            {
                'identifier': f"res_{q['question_id']}",
                'href': f"resources/{q['question_id']}.xml"
            } for q in data['questions']
        ]
        
        manifest_content = manifest_template.render(
            title=data['quiz_title'],
            resources=resources,
            identifier=str(uuid.uuid4())
        )
        
        with open(temp_path / 'imsmanifest.xml', 'w') as f:
            f.write(manifest_content)

    def _create_zip(self, temp_path, output_zip):
        """Package files into ZIP archive"""
        with zipfile.ZipFile(output_zip, 'w') as zipf:
            for file in temp_path.glob('**/*'):
                if file.is_file():
                    zipf.write(file, file.relative_to(temp_path))

if __name__ == '__main__':
    converter = QtiConverter()
    converter.convert_json_to_qti('input.json', 'qti_package.zip')