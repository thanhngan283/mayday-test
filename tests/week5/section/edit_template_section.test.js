
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

describe('W5 - PUT /api/templates/sections/:id',()=>{
 const url='/api/templates/sections/1';
 test('W5-SED-01/02/03/04/12: updates editable fields and preserves immutable ids',async()=>{
  sectionFixture();
  let r=await request(app).put(url).set('Authorization',`Bearer ${admin}`).send({title:'New title'});
  expect(r.body.code).toBe('1000');
  r=await request(app).put(url).set('Authorization',`Bearer ${admin}`).send({order:'2',is_required:'1',filled_by:'doctor',section_id:99,template_id:'OTHER'});
  expect(r.body.code).toBe('1000');expect(r.body.data.section_id).toBe(1);expect(r.body.data.template_id).toBe('TMPL_TEST');
  const d=await request(app).get('/api/templates/TMPL_TEST').set('Authorization',`Bearer ${admin}`);
  expect(d.body.data.sections[0].title).toBe('New title');expect(d.body.data.sections[0].order).toBe('2');
 });
 test('W5-SED-05: empty body',async()=>{sectionFixture();const r=await request(app).put(url).set('Authorization',`Bearer ${admin}`).send({});expect(r.body.code).toBe('2001');});
 test.each([
  [{title:123},'2002'],[{order:1},'2002'],[{is_required:true},'2002'],
  [{title:''},'2003'],[{title:'x'.repeat(201)},'2003'],[{title:'<b>'},'2003'],
  [{order:'abc'},'2003'],[{order:'10000'},'2003'],[{is_required:'2'},'2003'],[{filled_by:'nurse'},'2003']
 ])('W5-SED validation %#',async(body,code)=>{sectionFixture();const r=await request(app).put(url).set('Authorization',`Bearer ${admin}`).send(body);expect(r.body.code).toBe(code);});
 test('W5-SED-09/10: section not found',async()=>{let r=await request(app).put(url).set('Authorization',`Bearer ${admin}`).send({title:'x'});expect(r.body.code).toBe('3403');sectionFixture();r=await request(app).put('/api/templates/sections/999999999').set('Authorization',`Bearer ${admin}`).send({title:'x'});expect(r.body.code).toBe('3403');});
 test('W5-SED-11: structure locked when template is in use',async()=>{sectionFixture();app.db.medical_records.push({code_template:'TMPL_TEST'});const r=await request(app).put(url).set('Authorization',`Bearer ${admin}`).send({title:'x'});expect(r.body.code).toBe('3407');});
 test('W5-SED-14/15/16/17/18/19: auth and permission',async()=>{sectionFixture();let r=await request(app).put(url).send({title:'x'});expect(r.body.code).toBe('3003');r=await request(app).put(url).set('Authorization','Bearer abc').send({title:'x'});expect(r.body.code).toBe('3001');r=await request(app).put(url).set('Authorization','Bearer expired_token_mock').send({title:'x'});expect(r.body.code).toBe('3002');app.db.blacklist.add('token_1');r=await request(app).put(url).set('Authorization','Bearer token_1').send({title:'x'});expect(r.body.code).toBe('3001');r=await request(app).put(url).set('Authorization',`Bearer ${patient}`).send({title:'x'});expect(r.body.code).toBe('3102');r=await request(app).put(url).set('Authorization',`Bearer ${doctor}`).send({title:'x'});expect(r.body.code).toBe('3102');});
});
