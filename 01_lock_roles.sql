-- ProLink: منع تغيير الدور (role) أو صلاحية الأدمن من الواجهة
-- نفّذه في Supabase → SQL Editor. جرّبه أولاً بحساب الأدمن بعد التنفيذ.
-- القاعدة: المستخدم العادي يستطيع تحديد دوره مرة واحدة فقط (عندما يكون فارغاً)،
-- وأي تغيير بعد ذلك يتم فقط عن طريق الأدمن (موافقة طلب التحويل).

create or replace function public.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_is_admin boolean := false;
begin
  -- طلبات service_role / لوحة Supabase (بدون مستخدم) مسموحة
  if auth.uid() is null then
    return new;
  end if;

  select coalesce(p.is_admin, false) or p.role in ('admin','superadmin')
    into caller_is_admin
    from public.profiles p
   where p.id = auth.uid();

  if coalesce(caller_is_admin, false) then
    return new;
  end if;

  -- is_admin لا يُعدَّل من غير الأدمن أبداً
  if new.is_admin is distinct from old.is_admin then
    new.is_admin := old.is_admin;
  end if;

  -- الدور: يُسمح بتحديده فقط إذا كان فارغاً سابقاً وليس admin
  if new.role is distinct from old.role then
    if (old.role is null or old.role = '') and new.role in ('seeker','employer','freelancer') then
      return new;  -- أول اختيار للدور عند التسجيل
    end if;
    new.role := old.role;  -- أي تغيير آخر يُتجاهل
  end if;

  return new;
end;
$$;

drop trigger if exists trg_protect_profile_role on public.profiles;
create trigger trg_protect_profile_role
before update on public.profiles
for each row execute function public.protect_profile_role();

-- تحقق من القيمة الافتراضية لعمود role (يجب أن تكون null وليس 'employer')
select column_name, column_default
  from information_schema.columns
 where table_schema='public' and table_name='profiles' and column_name='role';
