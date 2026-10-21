
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

describe('W5 - PUT /api/templates/questions/:id',()=>{
 beforeEach(()=>{sectionFixture();questionFixture('radio',[{option_text:'Yes',option_value:'yes'},{option_text:'No',option_value:'no'}]);});
 const url='/api/templates/questions/Q_TEST';
 test('W5-QED-01/02/03/04/05/06/18: edits question, complete options set, and immutable fields',async()=>{
  let r=await request(app).put(url).set('Authorization',`Bearer ${admin}`).send({question_text:'Updated',placeholder:'Type here',order:'2',show_if_answer:'{}',question_id:'MASS',section_id:999,type_question:'text'});
  expect(r.body.code).toBe('1000');expect(r.body.data.question_id).toBe('Q_TEST');expect(r.body.data.section_id).toBe(1);expect(r.body.data.type_question).toBe('radio');
  const first=app.db.options[0].id;
  r=await request(app).put(url).set('Authorization',`Bearer ${admin}`).send({options:[{id:first,option_text:'Yep',option_value:'yes',order:'1'},{option_text:'Maybe',option_value:'maybe',order:'2'}]});
  expect(r.body.code).toBe('1000');expect(app.db.options).toHaveLength(2);expect(app.db.options.find(o=>o.id===first).option_text).toBe('Yep');
  const d=await request(app).get('/api/templates/TMPL_TEST').set('Authorization',`Bearer ${admin}`);expect(d.body.data.sections[0].questions[0].question_text).toBe('Updated');
 });
 test('W5-QED-07: empty body',async()=>{const r=await request(app).put(url).set('Authorization',`Bearer ${admin}`).send({});expect(r.body.code).toBe('2001');});
 test.each([
  [{question_text:123},'2002'],[{order:1},'2002'],[{show_if_answer:{}},'2002'],[{options:'abc'},'2002'],
  [{question_text:''},'2003'],[{question_text:'x'.repeat(501)},'2003'],[{question_text:'<b>'},'2003'],
  [{order:'abc'},'2003'],[{show_if_answer:'not json'},'2003'],
  [{options:[]},'2003'],[{options:[{id:999,option_text:'A',option_value:'a',order:'1'}]},'3406'],
  [{options:[{id:1,option_text:'A',option_value:'same',order:'1'},{option_text:'B',option_value:'same',order:'2'}]},'2003']
 ])('W5-QED validation %#',async(body,code)=>{const r=await request(app).put(url).set('Authorization',`Bearer ${admin}`).send(body);expect(r.body.code).toBe(code);});
 test('W5-QED-15/16: question not found after absent/deleted',async()=>{let r=await request(app).put('/api/templates/questions/Q_MISSING').set('Authorization',`Bearer ${admin}`).send({question_text:'x'});expect(r.body.code).toBe('3404');app.db.questions.length=0;r=await request(app).put(url).set('Authorization',`Bearer ${admin}`).send({question_text:'x'});expect(r.body.code).toBe('3404');});
 test('W5-QED-17: structure locked when template in use',async()=>{app.db.medical_records.push({code_template:'TMPL_TEST'});const r=await request(app).put(url).set('Authorization',`Bearer ${admin}`).send({question_text:'x'});expect(r.body.code).toBe('3407');});
 test('W5-QED-19/20/21/22/23/24/25: auth and permission',async()=>{let r=await request(app).put(url).send({question_text:'x'});expect(r.body.code).toBe('3003');r=await request(app).put(url).set('Authorization','Bearer abc').send({question_text:'x'});expect(r.body.code).toBe('3001');r=await request(app).put(url).set('Authorization','Bearer expired_token_mock').send({question_text:'x'});expect(r.body.code).toBe('3002');app.db.blacklist.add('token_1');r=await request(app).put(url).set('Authorization','Bearer token_1').send({question_text:'x'});expect(r.body.code).toBe('3001');r=await request(app).put(url).set('Authorization',`Bearer ${patient}`).send({question_text:'x'});expect(r.body.code).toBe('3102');r=await request(app).put(url).set('Authorization',`Bearer ${doctor}`).send({question_text:'x'});expect(r.body.code).toBe('3102');});
});
