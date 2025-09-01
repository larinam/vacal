import uuid

from backend.model import (
    Tenant,
    Team,
    TeamMember,
    get_unique_countries,
    get_team_id_and_member_uid_by_email,
)


def test_get_unique_countries() -> None:
    tenant = Tenant(name=str(uuid.uuid4()), identifier=str(uuid.uuid4())).save()
    Team(
        tenant=tenant,
        name="A",
        team_members=[
            TeamMember(name="Alice", country="United States"),
            TeamMember(name="Bob", country="Spain"),
        ],
    ).save()
    Team(
        tenant=tenant,
        name="B",
        team_members=[TeamMember(name="Carol", country="United States")],
    ).save()

    countries = get_unique_countries(tenant)
    assert set(countries) == {"United States", "Spain"}


def test_get_team_id_and_member_uid_by_email() -> None:
    tenant = Tenant(name=str(uuid.uuid4()), identifier=str(uuid.uuid4())).save()
    member = TeamMember(name="Dan", country="United States", email="dan@example.com")
    team = Team(tenant=tenant, name="Team", team_members=[member]).save()

    team_id, member_uid = get_team_id_and_member_uid_by_email(tenant, "dan@example.com")
    assert team_id == str(team.id)
    assert member_uid == str(member.uid)

    assert get_team_id_and_member_uid_by_email(tenant, "missing@example.com") == (None, None)

