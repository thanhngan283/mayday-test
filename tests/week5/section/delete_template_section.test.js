
const request = require('supertest');
const app = require('../../../app');
const admin = 'token_1', patient = 'token_2', doctor = 'token_3';
function reset() {
  for (const key of ['users','templates','sections','questions','options','medical_records']) app.db[key].length = 0;
  app.db.blacklist.clear();
  app.db.users.push(
    {user_id:1,full_name:'Admin',phone:'0912345678',password:'password123',role_id:3,is_active:1},
    {user_id:2,full_name:'Patient',phone:'0988776655',password:'password123',role_id:1,is_active:1},
    {user_id:3,full_name:'Doctor',phone:'0977444555',password:'password123',role_id:2,is_active:1}
  );
  app.db.templates.push({code_template:'TMPL_TEST',name:'Template test',description:null,version:'1.0',is_active:'1',sections:[]});
}
function sectionFixture() {
  const row={section_id:1,template_id:'TMPL_TEST',title:'Section test',order:'1',is_required:'0',filled_by:'patient'};
  app.db.sections.push(row); app.db.templates[0].sections.push(row); return row;
}
function questionFixture(type='text', options=[]) {
  const s=app.db.sections.find(x=>x.section_id===1)||sectionFixture();
  const q={question_id:'Q_TEST',section_id:s.section_id,question_text:'Question test',type_question:type,order:'1',placeholder:null,is_required:'0',help_text:null,allow_image:'0',show_if_answer:null,trigger_image_upload:'0',parent_question_id:null,options:[]};
  app.db.questions.push(q);
  options.forEach((o,i)=>{const x={id:i+1,question_id:q.question_id,option_text:o.option_text,option_value:o.option_value,order:String(i+1),trigger_image_upload:'0'};app.db.options.push(x);q.options.push(x);});
  return q;
}
beforeEach(reset);

describe('W5 - DELETE /api/templates/sections/:id',()=>{
 test('W5-SDL-01/02: deletes section and removes it from template detail',async()=>{sectionFixture();const r=await request(app).delete('/api/templates/sections/1').set('Authorization',`Bearer ${admin}`);expect(r.body.code).toBe('1000');const d=await request(app).get('/api/templates/TMPL_TEST').set('Authorization',`Bearer ${admin}`);expect(d.body.data.sections).toHaveLength(0);});
 test('W5-SDL-03: deleting section cascades questions and options',async()=>{sectionFixture();questionFixture('radio',[{option_text:'Yes',option_value:'yes'}]);const r=await request(app).delete('/api/templates/sections/1').set('Authorization',`Bearer ${admin}`);expect(r.body.code).toBe('1000');expect(app.db.questions).toHaveLength(0);expect(app.db.options).toHaveLength(0);});
 test.each([['/api/templates/sections/1','3403'],['/api/templates/sections/999999999','3403']])('W5-SDL-04/05: missing or repeated delete',async(url,code)=>{const r=await request(app).delete(url).set('Authorization',`Bearer ${admin}`);expect(r.body.code).toBe(code);});
 test('W5-SDL-06: structure locked when template is in use',async()=>{sectionFixture();app.db.medical_records.push({code_template:'TMPL_TEST'});const r=await request(app).delete('/api/templates/sections/1').set('Authorization',`Bearer ${admin}`);expect(r.body.code).toBe('3407');});
 test('W5-SDL-07/08/09/10/11/12: auth and permission',async()=>{sectionFixture();let r=await request(app).delete('/api/templates/sections/1');expect(r.body.code).toBe('3003');r=await request(app).delete('/api/templates/sections/1').set('Authorization','Bearer abc');expect(r.body.code).toBe('3001');r=await request(app).delete('/api/templates/sections/1').set('Authorization','Bearer expired_token_mock');expect(r.body.code).toBe('3002');app.db.blacklist.add('token_1');r=await request(app).delete('/api/templates/sections/1').set('Authorization','Bearer token_1');expect(r.body.code).toBe('3001');r=await request(app).delete('/api/templates/sections/1').set('Authorization',`Bearer ${patient}`);expect(r.body.code).toBe('3102');r=await request(app).delete('/api/templates/sections/1').set('Authorization',`Bearer ${doctor}`);expect(r.body.code).toBe('3102');});
});
