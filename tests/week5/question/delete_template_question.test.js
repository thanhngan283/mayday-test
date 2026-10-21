
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

describe('W5 - DELETE /api/templates/questions/:id',()=>{
 beforeEach(()=>{sectionFixture();questionFixture('radio',[{option_text:'Yes',option_value:'yes'}]);});
 const url='/api/templates/questions/Q_TEST';
 test('W5-QDL-01/02/03: deletes question and its options from detail',async()=>{const r=await request(app).delete(url).set('Authorization',`Bearer ${admin}`);expect(r.body.code).toBe('1000');expect(app.db.questions).toHaveLength(0);expect(app.db.options).toHaveLength(0);const d=await request(app).get('/api/templates/TMPL_TEST').set('Authorization',`Bearer ${admin}`);expect(d.body.data.sections[0].questions).toHaveLength(0);});
 test('W5-QDL-04: deleting parent detaches children',async()=>{app.db.questions.push({question_id:'Q_CHILD',section_id:1,parent_question_id:'Q_TEST',type_question:'text'});const r=await request(app).delete(url).set('Authorization',`Bearer ${admin}`);expect(r.body.code).toBe('1000');expect(app.db.questions[0].parent_question_id).toBe(null);});
 test.each([['/api/templates/questions/Q_TEST','3404'],['/api/templates/questions/Q_MISSING','3404']])('W5-QDL-05/06: deleting absent question',async(url,code)=>{app.db.questions.length=0;const r=await request(app).delete(url).set('Authorization',`Bearer ${admin}`);expect(r.body.code).toBe(code);});
 test('W5-QDL-07: structure locked when template in use',async()=>{app.db.medical_records.push({code_template:'TMPL_TEST'});const r=await request(app).delete(url).set('Authorization',`Bearer ${admin}`);expect(r.body.code).toBe('3407');});
 test('W5-QDL-08/09/10/11/12/13: auth and permission',async()=>{let r=await request(app).delete(url);expect(r.body.code).toBe('3003');r=await request(app).delete(url).set('Authorization','Bearer abc');expect(r.body.code).toBe('3001');r=await request(app).delete(url).set('Authorization','Bearer expired_token_mock');expect(r.body.code).toBe('3002');app.db.blacklist.add('token_1');r=await request(app).delete(url).set('Authorization','Bearer token_1');expect(r.body.code).toBe('3001');r=await request(app).delete(url).set('Authorization',`Bearer ${patient}`);expect(r.body.code).toBe('3102');r=await request(app).delete(url).set('Authorization',`Bearer ${doctor}`);expect(r.body.code).toBe('3102');});
});
