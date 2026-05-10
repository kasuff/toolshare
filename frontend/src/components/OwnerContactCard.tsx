import { User } from "../types/domain";

interface OwnerContactCardProps {
  owner: User;
}

export function OwnerContactCard({ owner }: OwnerContactCardProps) {
  return (
    <div className="owner-contact-card">
      <h3>Deine Kontaktdaten</h3>
      <div className="contact-info">
        <div className="contact-field">
          <label>Name</label>
          <p>{owner.name}</p>
        </div>
        <div className="contact-field">
          <label>E-Mail</label>
          <p>
            <a href={`mailto:${owner.email}`}>{owner.email}</a>
          </p>
        </div>
      </div>
    </div>
  );
}
