# Problem
Tracking who is performing the worst in Team Trials is difficult. This project is supposed to create an easy way to track umas in Team Trials. 
The Team Trials Team is 15 umas. 3 in each aptitude, sprint, mile, medium, long, dirt. 
A uma can not appear twice (different outfit, same uma also counts and cannot appear with different outfits). 
A button to reset a uma in the team. This should allow us to reselect but should be auto filled with the previous uma as it is likely they just rebuilt and is the same uma but better. 

There are 3 states for the tracking portion. 
1. Filling the roster
2. Adding top 1,2,3 and bottom 1,2,3
3. Replacing an Uma

The `adjustingPeriod` is a modifier for when a uma is replaced. 
`placement` is a variable for top 3 performers and bottom 3 from 1 to 3 and -1 to -3. 

```
newRating = currentRating + (baseRating * (1 + placement / 20) - currentRating) / adjustingPeriod
```

This system should sort of act like an elo system with a cap resulting in good umas filtering to the top and bad umas (relative to the rest of the team) filtering to the bottom. 

There also should be a graph that tracks rating over time, showing the rise, fall of each uma. 

The full list of Umas are can be found in `Character List _ Uma Musume _ GameTora.htm`.