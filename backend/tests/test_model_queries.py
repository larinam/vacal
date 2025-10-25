import datetime
import uuid

from backend.model import (
    Tenant,
    Team,
    TeamMember,
    get_unique_countries,
    get_team_id_and_member_uid_by_email,
)


def _create_tenant() -> Tenant:
    return Tenant(name=str(uuid.uuid4()), identifier=str(uuid.uuid4())).save()


def test_get_unique_countries() -> None:
    tenant = _create_tenant()
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
    tenant = _create_tenant()
    member = TeamMember(name="Dan", country="United States", email="dan@example.com")
    team = Team(tenant=tenant, name="Team", team_members=[member]).save()

    team_id, member_uid = get_team_id_and_member_uid_by_email(tenant, "dan@example.com")
    assert team_id == str(team.id)
    assert member_uid == str(member.uid)

    assert get_team_id_and_member_uid_by_email(tenant, "missing@example.com") == (None, None)


def test_team_soft_delete_filters_objects() -> None:
    tenant = _create_tenant()
    team = Team(tenant=tenant, name="Team", team_members=[]).save()

    assert Team.objects(tenant=tenant).count() == 1

    team.is_deleted = True
    team.deleted_at = datetime.datetime.now(datetime.timezone.utc)
    team.save()

    assert Team.objects(tenant=tenant).count() == 0
    assert Team.objects_with_deleted(tenant=tenant).count() == 1
    assert Team.objects_with_deleted(tenant=tenant).deleted().count() == 1

    team.is_deleted = False
    team.deleted_at = None
    team.save()

    assert Team.objects(tenant=tenant).count() == 1


def test_team_member_soft_delete_and_restore() -> None:
    tenant = _create_tenant()
    member = TeamMember(name="Eve", country="United States")
    team = Team(tenant=tenant, name="Team", team_members=[member]).save()
    member_uid = str(team.team_members[0].uid)

    team_member = team.get_member(member_uid)
    team_member.is_deleted = True
    team_member.deleted_at = datetime.datetime.now(datetime.timezone.utc)
    team.save()

    team.reload()
    assert team.get_member(member_uid) is None
    archived_member = team.get_member(member_uid, include_archived=True)
    assert archived_member is not None and archived_member.is_deleted
    assert team.members() == []

    archived_member.is_deleted = False
    archived_member.deleted_at = None
    archived_member.deleted_by = None
    team.save()

    team.reload()
    restored_member = team.get_member(member_uid)
    assert restored_member is not None and not restored_member.is_deleted
    assert len(team.members()) == 1

