from .util import normalize_name
class Student:
    def __init__(self, entry, subject, message):
        first_column = list(entry.keys())[0]
        self.name = normalize_name(entry[first_column])
        self.display_name = ' '.join(reversed(entry[first_column].split(', ')))
        self.first_name = self.name.split(' ')[0]
        self.grade = entry[list(entry.keys())[1]].split(" ")[0]
        self.percent = entry[list(entry.keys())[1]].split(" ")[1]
        self.subject = subject
        self.message = message
        self.missing_assignments = []
        for header in entry.keys():
            if header != first_column and header != list(entry.keys())[1]:
                if entry[header] and (entry[header] == "0" or entry[header] == "0.0"):
                    self.missing_assignments.append(header)

    def getGrade(self):
        return float(self.percent.strip('%'))

    
