import { Fragment } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { CaretLeft, CaretRight } from '@phosphor-icons/react';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import { breadcrumbFor } from '@/lib/breadcrumbs';
import { cn } from '@/lib/utils';
import { useAuth } from '../../auth/AuthContext';

export default function ContentHeader({ className }: { className?: string }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { user } = useAuth();
  const crumbs = user ? breadcrumbFor(pathname, user.appRole) : [];

  return (
    <div className={cn('px-4 pt-4 md:px-6', className)}>
      <div className="flex min-h-12 items-center gap-1 rounded-xl border border-border bg-topbar px-2">
        <Button variant="ghost" iconOnly size="sm" aria-label="Indietro" onClick={() => navigate(-1)}>
          <CaretLeft />
        </Button>
        <Button variant="ghost" iconOnly size="sm" aria-label="Avanti" onClick={() => navigate(1)}>
          <CaretRight />
        </Button>
        <span aria-hidden="true" className="mx-2 h-5 w-px bg-border" />
        <Breadcrumb aria-label="Percorso">
          <BreadcrumbList>
            {crumbs.map((crumb, index) => (
              <Fragment key={`${crumb.label}-${index}`}>
                {index > 0 && <BreadcrumbSeparator />}
                <BreadcrumbItem>
                  {crumb.to ? (
                    <BreadcrumbLink asChild>
                      <Link to={crumb.to}>{crumb.label}</Link>
                    </BreadcrumbLink>
                  ) : (
                    <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                  )}
                </BreadcrumbItem>
              </Fragment>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
      </div>
    </div>
  );
}
