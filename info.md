# Team Trials Tracker
Team Trials Tracker is a manual rating tracker for your umamusume in team trials with the explict goal of identifying poor performers. 
## How does it work
The rating works by inputing the top 3 and bottom 3 placing umamusume in a team trials round. 
Where top 3 get a base of `+30`, `+20`, `+10` and bottom 3 gets negative counterpart of the score. This is scaled by how recent the umamusume was added (up to 5x decaying to 1x in 5 turns). The score has a natural drift that is exponential the further away from `1000` you get. The final result is normalised to center on `1000`.
Each round, for every umamusume (`p` = placement: top 1/2/3 = `+3/+2/+1`, bottom 3/2/1 = `-1/-2/-3`, otherwise `0`; `n` = rounds it has been rated since it was added):
- `period = min(5, n + 1)`
- `rating = rating + 1000 * p / 20 / period`
- `rating = rating - sign(d) * 2^(|d| / 200)` where `d = rating - 1000` (never passes `1000`)
- Finally every rating is shifted by the same amount so the average is `1000`, and kept within `0` to `2000`.
## Key features
- Fast round tracking, I would like to thank SheffPlays for inspiring the top 3, bottom 3 for quick tracking. 
- Centred on `1000` so you can easily identify the average and umamusume that diverge from the median. 
- Adapts when you rebuild an umamusume. Rebuilds should not ruin the rating system and you should be able to quickly tell if they are performing well or not. 