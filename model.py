from mongoengine import StringField, ReferenceField, DateField, ListField, connect, Document, EmbeddedDocument, \
    EmbeddedDocumentListField

connect('vacal')


class User(EmbeddedDocument):
    name = StringField(required=True)
    country = StringField(required=True)  # country name from pycountry
    vac_days = ListField(DateField(required=True))


class Team(Document):
    name = StringField(required=True)
    team_members = EmbeddedDocumentListField(User)
