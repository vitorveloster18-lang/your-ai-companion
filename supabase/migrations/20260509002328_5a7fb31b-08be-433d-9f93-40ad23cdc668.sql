
insert into storage.buckets (id, name, public)
values ('avatar-videos', 'avatar-videos', true)
on conflict (id) do nothing;

create policy "Public read avatar videos"
on storage.objects for select
using (bucket_id = 'avatar-videos');

create policy "Public upload avatar videos"
on storage.objects for insert
with check (bucket_id = 'avatar-videos');

create policy "Public update avatar videos"
on storage.objects for update
using (bucket_id = 'avatar-videos');

create policy "Public delete avatar videos"
on storage.objects for delete
using (bucket_id = 'avatar-videos');
