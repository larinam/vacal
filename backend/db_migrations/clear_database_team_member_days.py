# def clear_team_member_days():
#     # Iterate over each team
#     for team in Team.objects:
#         # Flag to track if any updates are needed
#         update_needed = False

#         # Iterate over each team member in the team
#         for member in team.team_members:
#             if member.days:
#                 # Clear the days field
#                 member.days = {}
#                 # Set the flag indicating that an update is needed
#                 update_needed = True

#         # If any team member was updated, save the team document
#         if update_needed:
#             team.save()

# # Call the function to clear days from all team members
# clear_team_member_days()