vacation_day_type = DayType.objects(name="Vacation").first()
if not vacation_day_type:
    vacation_day_type = DayType(name="Vacation", color="#48BF91").save()

for team in Team.objects:
    for member in team.team_members:
        for vac_day in member.vac_days:
            date_str = vac_day.strftime("%Y-%m-%d")
            if date_str not in member.days:
                member.days[date_str] = []
            member.days[date_str].append(vacation_day_type)
        team.save()
