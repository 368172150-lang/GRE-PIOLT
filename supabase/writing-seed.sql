-- Original AI-assisted, author-reviewed Issue prompts. No user activity.
insert into public.writing_prompts(id,title,prompt,source,review_status) values
('public-spaces','Public spaces and local priorities','Local governments should invest more in public spaces, such as parks and libraries, than in attracting large private businesses.

Write a response in which you discuss the extent to which you agree or disagree with the statement. Explain your reasoning and consider circumstances in which the statement might or might not hold true.','original:gre-pilot:ai-assisted:author-reviewed','reviewed'),
('learning-failure','Learning from unsuccessful attempts','Students learn more from projects that do not achieve their intended goals than from projects that succeed.

Write a response in which you discuss the extent to which you agree or disagree with the statement. Develop your position with reasons and examples, and address a possible challenge to your view.','original:gre-pilot:ai-assisted:author-reviewed','reviewed'),
('technology-choice','Technology and personal choice','As technology makes everyday decisions easier, people become less capable of making important decisions independently.

Write a response in which you discuss the extent to which you agree or disagree with the statement. Consider how different uses of technology might affect your conclusion.','original:gre-pilot:ai-assisted:author-reviewed','reviewed'),
('research-value','Research and immediate benefits','The value of scientific research should be judged primarily by its ability to produce immediate practical benefits.

Write a response in which you discuss the extent to which you agree or disagree with the statement. Support your position with reasons and examples, and consider the implications of your position.','original:gre-pilot:ai-assisted:author-reviewed','reviewed')
on conflict(id) do update set title=excluded.title,prompt=excluded.prompt,source=excluded.source,review_status=excluded.review_status;
